/**
 * Cloudflare Workers のエントリポイント
 *
 * Cloudflare 固有のもの（D1・Rate Limiting バインディング・Turnstile・Cron の scheduled）はこのファイルと
 * adapters/ だけに閉じ込める。ドメイン・ルーティングは Workers に依存しない。
 *
 * 静的ファイル（Web 版クライアント）は wrangler.jsonc の assets で配信し、/api/* だけがこの Worker に来る。
 */
import { drizzle } from 'drizzle-orm/d1';
import { cloudflareCache } from './adapters/cache';
import { turnstileVerifier } from './adapters/humanCheck';
import { cloudflareRateLimiter } from './adapters/rateLimiter';
import { steamTicketVerifier } from './adapters/steamAuth';
import { createApp, type AppDeps } from './app';
import * as schema from './db/schema';
import type { DomainContext } from './domain/context';
import { readConfig, type Env } from './env';
import { runScheduledJobs } from './jobs/scheduled';
import { createDrizzleRepositories } from './repositories/drizzle';

/**
 * 開発用の時計のずれ（ミリ秒）。DEV_CLOCK=1 のときだけ使う（wrangler dev は1つの実行環境で動くので、
 * ここに覚えておけば以降のリクエストに効く）。本番では DEV_CLOCK を設定しないので常に 0
 */
let devClockOffsetMs = 0;

function domainContext(env: Env): DomainContext {
  const config = readConfig(env);
  return {
    repos: createDrizzleRepositories(drizzle(env.DB, { schema })),
    config,
    now: () => Date.now() + (config.devClock ? devClockOffsetMs : 0),
    cache: cloudflareCache(),
  };
}

const app = createApp({
  resolveDeps: (raw): AppDeps => {
    const env = raw as Env;
    const ctx = domainContext(env);
    return {
      ctx,
      readLimiter: cloudflareRateLimiter(env.RATE_LIMIT_READ),
      writeLimiter: cloudflareRateLimiter(env.RATE_LIMIT_WRITE),
      humanVerifier: turnstileVerifier(ctx.config.turnstileSecretKey),
      steamAuth: steamTicketVerifier(ctx.config.steam),
      devClock: ctx.config.devClock
        ? {
            advance: (ms) => {
              devClockOffsetMs += ms;
              return ctx.now();
            },
          }
        : undefined,
    };
  },
  corsOrigins: (raw) => readConfig(raw as Env).corsOrigins,
});

export default {
  fetch: app.fetch,
  /** Cron Triggers: トリガーはジョブを呼ぶだけ（ジョブ本体は jobs/ にあり、単体でも実行できる） */
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(runScheduledJobs(domainContext(env)));
  },
} satisfies ExportedHandler<Env>;
