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
import { getLatestMarket } from './domain/market/market';
import { signInWithExternal, type ExternalAuthProvider } from './domain/players/externalAuth';
import { authenticate, registerPlayer, updateName } from './domain/players/players';
import { commitAttempt, getAttempt, getCurrentWeek, startAttempt } from './domain/weekly/attempts';
import { getProvisional } from './domain/weekly/provisional';
import { getLatest, getReplay, getResults } from './domain/weekly/results';

export interface AppDeps {
  ctx: DomainContext;
  /** 読み取り系（ランキングなど）と書き込み系（登録・本番）で別の上限 */
  readLimiter: RateLimiter;
  writeLimiter: RateLimiter;
  /** 匿名登録時の人間確認（Turnstile） */
  humanVerifier: HumanVerifier;
  /** Steam 版の本人確認（Web API チケットの検証） */
  steamAuth: ExternalAuthProvider;
  /** 開発用の時計（DEV_CLOCK=1 のときだけ。本番では undefined） */
  devClock?: { advance(ms: number): number };
}

type AppEnv = { Variables: { deps: AppDeps } };

const STATUS: Record<ApiErrorCode, ContentfulStatusCode> = {
  badRequest: 400,
  invalidName: 400,
  invalidSubmission: 400,
  unauthorized: 401,
  humanCheckFailed: 403,
  forbidden: 403,
  serviceUnavailable: 503,
  notFound: 404,
  alreadyPlayed: 409,
  simVersionMismatch: 409,
  challengeClosed: 410,
  notPublished: 404,
  tallying: 425,
  clientOutdated: 410,
  rateLimited: 429,
};

/** プレイヤー単位のレート制限に引っかかった */
class RateLimitedError extends Error {}

const fail = (c: Context, code: ApiErrorCode) => c.json<ApiError>({ error: code }, STATUS[code]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

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
    const body: unknown = await readJson(c);
    if (!isRecord(body)) throw new DomainError('badRequest');
    const token = body.turnstileToken;
    if (typeof token !== 'string' || token.length === 0) throw new DomainError('badRequest');
    const ip = clientIp(c);
    if (!(await c.get('deps').humanVerifier.verify(token, ip))) {
      throw new DomainError('humanCheckFailed');
    }
    return c.json(await registerPlayer(ctxOf(c), ip));
  });
  // Steam 版: Steam のチケットで本人確認できるので人間確認は省く（IP 単位のレート制限は上でかかっている）
  app.post('/auth/steam', async (c) =>
    c.json(
      await signInWithExternal(
        ctxOf(c),
        'steam',
        c.get('deps').steamAuth,
        await readJson(c),
        clientIp(c),
      ),
    ),
  );
  app.put('/players/me/name', async (c) => {
    const player = await playerOf(c);
    const body: unknown = await readJson(c);
    const displayName = isRecord(body) ? body.displayName : undefined;
    return c.json({ displayName: await updateName(ctxOf(c), player, displayName) });
  });

  /** ログインしていれば自分、していなければ null（ランキング・今週の情報は誰でも見られる） */
  const optionalPlayer = async (c: Context<AppEnv>) =>
    c.req.header('Authorization') ? await playerOf(c).catch(() => null) : null;

  // ---- 週替わりチャレンジ ----
  app.get('/weekly/current', async (c) =>
    c.json(await getCurrentWeek(ctxOf(c), await optionalPlayer(c))),
  );
  app.post('/weekly/:week/attempts', async (c) =>
    c.json({ attempt: await startAttempt(ctxOf(c), await playerOf(c), c.req.param('week')) }),
  );
  app.get('/weekly/:week/attempts/:day', async (c) =>
    c.json(await getAttempt(ctxOf(c), await playerOf(c), c.req.param('week'), c.req.param('day'))),
  );
  app.post('/weekly/:week/attempts/:day/commit', async (c) => {
    const player = await playerOf(c);
    const { week, day } = c.req.param();
    return c.json(await commitAttempt(ctxOf(c), player, week, day, await readJson(c)));
  });
  // 当週の暫定ランキング（順位・表示名・出荷量だけ。他人の配置・操作ログは返さない）
  app.get('/weekly/:week/provisional', async (c) =>
    c.json(await getProvisional(ctxOf(c), c.req.param('week'), await optionalPlayer(c))),
  );
  // 結果発表（締め切り後・確定済みの週だけ。秘密値もここで公開する）
  app.get('/weekly/:week/results', async (c) =>
    c.json(await getResults(ctxOf(c), c.req.param('week'), await optionalPlayer(c))),
  );
  app.get('/weekly/:week/results/:rank/replay', async (c) =>
    c.json(await getReplay(ctxOf(c), c.req.param('week'), Number(c.req.param('rank')))),
  );
  app.get('/weekly/latest', async (c) => c.json(await getLatest(ctxOf(c))));

  // 旧 API（デイリー）: アプリの更新を促す
  app.all('/daily/*', (c) => fail(c, 'clientOutdated'));

  // ---- 開発用の時計（DEV_CLOCK=1 かつ localhost のときだけ。週の切り替え・結果発表の確認用） ----
  app.post('/dev/clock', async (c) => {
    const clock = c.get('deps').devClock;
    const host = new URL(c.req.url).hostname;
    if (!clock || (host !== 'localhost' && host !== '127.0.0.1')) return fail(c, 'notFound');
    const body: unknown = await readJson(c);
    const advanceMs = isRecord(body) ? body.advanceMs : undefined;
    if (typeof advanceMs !== 'number' || !Number.isFinite(advanceMs)) {
      throw new DomainError('badRequest');
    }
    return c.json({ now: clock.advance(advanceMs) });
  });

  // ---- 相場（通常ランの開始時の価格・ショップの前日比の表示に使う） ----
  app.get('/market/latest', async (c) => c.json(await getLatestMarket(ctxOf(c))));

  app.notFound((c) => fail(c, 'notFound'));
  return app;
}
