/**
 * Cloudflare Workers のエントリポイント
 *
 * Cloudflare 固有のもの（D1・Rate Limiting バインディング・Turnstile・Cron の scheduled）はこのファイルと
 * adapters/ だけに閉じ込める。ドメイン・ルーティングは Workers に依存しない。
 *
 * 静的ファイル（Web 版クライアント）は wrangler.jsonc の assets で配信し、/api/* だけがこの Worker に来る。
 */
import { drizzle } from 'drizzle-orm/d1';
import { turnstileVerifier } from './adapters/humanCheck';
import { cloudflareRateLimiter } from './adapters/rateLimiter';
import { createApp, type AppDeps } from './app';
import * as schema from './db/schema';
import type { DomainContext } from './domain/context';
import { readConfig, type Env } from './env';
import { runScheduledJobs } from './jobs/scheduled';
import { createDrizzleRepositories } from './repositories/drizzle';

function domainContext(env: Env): DomainContext {
  return {
    repos: createDrizzleRepositories(drizzle(env.DB, { schema })),
    config: readConfig(env),
    now: () => Date.now(),
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
