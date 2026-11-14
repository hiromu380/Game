/**
 * ジョブをトリガー（Cron）なしで単体実行する
 *
 * 使い方（apps/server で）:
 *   pnpm job prepare             … wrangler dev のローカル D1 に、今週から数週先までの盤面を用意（先行生成）
 *   pnpm job verify              … 未検証の週を自動検証する（時間の予算なしで、終わるまで）
 *   pnpm job open                … 今週を開く（前週の購入率から相場を確定）
 *   pnpm job finalize            … 前週・前々週の結果を確定する（結果発表）
 *   pnpm job purge               … 保存期間を過ぎた挑戦・確定結果・IP ハッシュを消す
 *   pnpm job all                 … Cron と同じ順番ですべて
 *   pnpm job all --db x.sqlite   … 任意の SQLite ファイルに対して実行（マイグレーションも流す）
 *   pnpm job all --at 2026-10-05T00:00:00Z … 時刻を指定して実行
 *
 * 秘密値は .dev.vars（なければ環境変数）から読む。
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { applyMigrations, openNodeSqlite } from '../src/adapters/nodeSqlite';
import { memoryCache } from '../src/adapters/cache';
import type { DomainContext } from '../src/domain/context';
import { runIpPurgeJob } from '../src/domain/players/privacy';
import { runFinalizeJob, runWeeklyPurgeJob } from '../src/domain/weekly/results';
import { prepareWeeks, runOpenWeekJob, verifyWeeks } from '../src/domain/weekly/weeks';
import { readConfig, type Env } from '../src/env';
import { runScheduledJobs } from '../src/jobs/scheduled';
import { createDrizzleRepositories } from '../src/repositories/drizzle';

const JOBS: Record<string, (ctx: DomainContext) => Promise<unknown>> = {
  prepare: prepareWeeks,
  // 手動実行では時間の予算を気にせず、終わるまで進める（時計を止めて予算を使い切らないようにする）
  verify: (ctx) => verifyWeeks(ctx, () => 0),
  open: runOpenWeekJob,
  finalize: runFinalizeJob,
  purge: async (ctx) => ({
    weekly: await runWeeklyPurgeJob(ctx),
    ip: await runIpPurgeJob(ctx),
  }),
  /** Cron と同じ順番ですべて実行 */
  all: runScheduledJobs,
};

const SERVER_DIR = join(import.meta.dirname, '..');
/** wrangler dev のローカル D1 の置き場所 */
const LOCAL_D1_DIR = join(SERVER_DIR, '.wrangler/state/v3/d1/miniflare-D1DatabaseObject');

function option(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** .dev.vars（KEY=VALUE 形式）を読み、環境変数で上書きする */
function loadVars(): Record<string, string> {
  const vars: Record<string, string> = {};
  const file = join(SERVER_DIR, '.dev.vars');
  if (existsSync(file)) {
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m) vars[m[1]!] = m[2]!;
    }
  }
  for (const [k, v] of Object.entries(process.env)) if (typeof v === 'string') vars[k] = v;
  return vars;
}

function localD1File(): string {
  const file = existsSync(LOCAL_D1_DIR)
    ? readdirSync(LOCAL_D1_DIR).find((f) => f.endsWith('.sqlite') && f !== 'metadata.sqlite')
    : undefined;
  if (!file) throw new Error('local D1 not found. Run `pnpm db:migrate:local` first, or pass --db');
  return join(LOCAL_D1_DIR, file);
}

async function main() {
  const name = process.argv[2] ?? '';
  const job = JOBS[name];
  if (!job)
    throw new Error(`usage: pnpm job <${Object.keys(JOBS).join('|')}> [--db file] [--at ISO]`);

  const dbPath = option('db');
  const { db, raw } = openNodeSqlite(dbPath ?? localD1File());
  if (dbPath) applyMigrationsIfEmpty(raw);

  const at = option('at');
  const now = () => (at ? Date.parse(at) : Date.now());
  const ctx: DomainContext = {
    repos: createDrizzleRepositories(db),
    config: readConfig(loadVars() as unknown as Env),
    now,
    cache: memoryCache(now),
  };
  console.log(name, await job(ctx));
}

/** 指定したファイルが空なら、マイグレーションを流して使えるようにする */
function applyMigrationsIfEmpty(raw: ReturnType<typeof openNodeSqlite>['raw']) {
  const tables = raw.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all();
  if (tables.length === 0) applyMigrations(raw);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
