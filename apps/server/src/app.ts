/**
 * HTTP の入り口（Hono）
 *
 * ここはリクエストの読み取り・認証・レート制限・エラー変換だけを行い、処理はドメインの関数に任せる。
 * 依存（DB・設定・レート制限）は resolveDeps で外から受け取るので、Workers 以外（テスト・Node）でも動く。
 */
import type { ApiError, ApiErrorCode } from '@chain-factory/shared';
import { Hono, type Context } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { HumanVerifier } from './adapters/humanCheck';
import type { RateLimiter } from './adapters/rateLimiter';
import { SERVER_LIMITS } from './config/server';
import { DomainError, type DomainContext } from './domain/context';
import {
  commitDaily,
  getSession,
  getToday,
  revealDaily,
  startDaily,
} from './domain/daily/dailyService';
import { authenticate, registerPlayer, updateName } from './domain/players/players';
import { getLatestMarket } from './domain/market/market';
import { getRanking } from './domain/ranking/ranking';

export interface AppDeps {
  ctx: DomainContext;
  /** 読み取り系（ランキングなど）と書き込み系（登録・本番）で別の上限 */
  readLimiter: RateLimiter;
  writeLimiter: RateLimiter;
  /** 匿名登録時の人間確認（Turnstile） */
  humanVerifier: HumanVerifier;
}

type AppEnv = { Variables: { deps: AppDeps } };

const STATUS: Record<ApiErrorCode, ContentfulStatusCode> = {
  badRequest: 400,
  invalidName: 400,
  invalidSubmission: 400,
  unauthorized: 401,
  humanCheckFailed: 403,
  notFound: 404,
  alreadyPlayed: 409,
  simVersionMismatch: 409,
  dailyClosed: 410,
  rateLimited: 429,
};

/** プレイヤー単位のレート制限に引っかかった */
class RateLimitedError extends Error {}

const fail = (c: Context, code: ApiErrorCode) => c.json<ApiError>({ error: code }, STATUS[code]);

/** 送信元の IP（プロキシが付けるヘッダーを順に見る）。わからなければ null */
function clientIp(c: Context): string | null {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    null
  );
}

/** JSON 本文を読む。壊れていれば badRequest */
async function readJson(c: Context): Promise<unknown> {
  try {
    return await c.req.json();
  } catch {
    throw new DomainError('badRequest');
  }
}

export function createApp(options: {
  resolveDeps: (env: unknown) => AppDeps;
  corsOrigins?: (env: unknown) => string[];
}) {
  const app = new Hono<AppEnv>().basePath('/api');

  // API の応答にもセキュリティヘッダーを付ける（静的ファイルは apps/client/public/_headers）
  app.use('*', secureHeaders());

  // CORS は既定では出さない（同一オリジン配信）。別オリジンから呼ぶ必要がある場合だけ、設定したオリジンを許可する
  app.use('*', async (c, next) => {
    const origins = options.corsOrigins?.(c.env) ?? [];
    if (origins.length === 0) return next();
    return cors({ origin: origins, allowHeaders: ['Authorization', 'Content-Type'] })(c, next);
  });
  app.use(
    '*',
    bodyLimit({ maxSize: SERVER_LIMITS.maxBodyBytes, onError: (c) => fail(c, 'badRequest') }),
  );
  app.use('*', async (c, next) => {
    c.set('deps', options.resolveDeps(c.env));
    await next();
  });

  /** レート制限・IP 単位（GET は読み取り、それ以外は書き込みの上限） */
  app.use('*', async (c, next) => {
    const { readLimiter, writeLimiter } = c.get('deps');
    const limiter = c.req.method === 'GET' ? readLimiter : writeLimiter;
    if (!(await limiter.allow(`ip:${clientIp(c) ?? 'unknown'}`))) return fail(c, 'rateLimited');
    await next();
  });

  app.onError((err, c) => {
    if (err instanceof DomainError) return fail(c, err.code);
    if (err instanceof RateLimitedError) return fail(c, 'rateLimited');
    console.error(err);
    return c.json({ error: 'internal' }, 500);
  });

  const ctxOf = (c: Context<AppEnv>) => c.get('deps').ctx;
  /**
   * 認証してプレイヤーを返す。書き込み系はプレイヤー単位のレート制限もかける
   * （IP を変えながらの連打を防ぐ。認証の後で数えるので、他人の ID を騙って枠を消費させることはできない）
   */
  const playerOf = async (c: Context<AppEnv>) => {
    const player = await authenticate(ctxOf(c), c.req.header('Authorization'));
    if (
      c.req.method !== 'GET' &&
      !(await c.get('deps').writeLimiter.allow(`player:${player.id}`))
    ) {
      throw new RateLimitedError();
    }
    return player;
  };

  // ---- プレイヤー ----
  // 匿名登録は人間確認（Turnstile）を通ったときだけ
  app.post('/players', async (c) => {
    const body = (await readJson(c)) as { turnstileToken?: unknown };
    const token = typeof body?.turnstileToken === 'string' ? body.turnstileToken : '';
    const ip = clientIp(c);
    if (!(await c.get('deps').humanVerifier.verify(token, ip))) {
      throw new DomainError('humanCheckFailed');
    }
    return c.json(await registerPlayer(ctxOf(c), ip));
  });
  app.put('/players/me/name', async (c) => {
    const player = await playerOf(c);
    const body = (await readJson(c)) as { displayName?: unknown };
    return c.json({ displayName: await updateName(ctxOf(c), player, body?.displayName) });
  });

  // ---- デイリー ----
  app.get('/daily/today', async (c) => c.json(await getToday(ctxOf(c))));
  app.post('/daily/:id/start', async (c) =>
    c.json({ session: await startDaily(ctxOf(c), await playerOf(c), c.req.param('id')) }),
  );
  app.get('/daily/:id/session', async (c) =>
    c.json(await getSession(ctxOf(c), await playerOf(c), c.req.param('id'))),
  );
  app.post('/daily/:id/commit', async (c) => {
    const player = await playerOf(c);
    return c.json(await commitDaily(ctxOf(c), player, c.req.param('id'), await readJson(c)));
  });
  app.get('/daily/:id/reveal', async (c) => c.json(await revealDaily(ctxOf(c), c.req.param('id'))));

  // ---- ランキング（ログインしていなくても見られる。していれば自分の順位も返す） ----
  app.get('/daily/:id/ranking', async (c) => {
    const auth = c.req.header('Authorization');
    const me = auth ? await playerOf(c).catch(() => null) : null;
    return c.json(await getRanking(ctxOf(c), c.req.param('id'), me));
  });

  // ---- 相場（通常ランの開始時の価格・ショップの前日比の表示に使う） ----
  app.get('/market/latest', async (c) => c.json(await getLatestMarket(ctxOf(c))));

  app.notFound((c) => fail(c, 'notFound'));
  return app;
}
