/**
 * 環境変数とバインディング（CLAUDE.md「環境依存の設定は環境変数に集約する」）
 *
 * - Env: Workers から渡される生の値（wrangler.jsonc の vars・Secrets・バインディング）
 * - AppConfig: ドメインが使う形に読み替えた設定。ドメインは Env を直接見ない
 *
 * 秘密値（DAILY_MASTER_SECRET）は Workers の Secrets で管理し、ローカルは .dev.vars（git 管理外）に置く。
 */

export interface Env {
  DB: D1Database;
  /** Rate Limiting バインディング（API 全般 / 書き込み系） */
  RATE_LIMIT_READ?: RateLimit;
  RATE_LIMIT_WRITE?: RateLimit;

  /** デイリーの秘密値の元になるマスター秘密鍵（Secrets） */
  DAILY_MASTER_SECRET: string;
  /** デイリーの切り替え時刻（UTC からのずれ・分）。既定 540 = 日本時間0時 */
  DAILY_OFFSET_MINUTES?: string;
  /** デイリー #1 の日付 */
  DAILY_EPOCH?: string;
  /** CORS を許可するオリジン（カンマ区切り）。同一オリジン配信なら不要 */
  CORS_ORIGINS?: string;
}

export interface AppConfig {
  masterSecret: string;
  dailyOffsetMinutes: number;
  dailyEpoch: string;
  corsOrigins: string[];
}

const DEFAULT_OFFSET_MINUTES = 540;
const DEFAULT_EPOCH = '2026-10-01';

/** 生の環境変数を AppConfig に読み替える（不足・不正な値はここで早めにエラーにする） */
export function readConfig(
  env: Omit<Env, 'DB' | 'RATE_LIMIT_READ' | 'RATE_LIMIT_WRITE'>,
): AppConfig {
  if (!env.DAILY_MASTER_SECRET || env.DAILY_MASTER_SECRET.length < 32) {
    throw new Error(
      'DAILY_MASTER_SECRET must be set (32+ chars). See apps/server/.dev.vars.example',
    );
  }
  const offset = Number(env.DAILY_OFFSET_MINUTES ?? DEFAULT_OFFSET_MINUTES);
  if (!Number.isInteger(offset)) throw new Error('DAILY_OFFSET_MINUTES must be an integer');
  return {
    masterSecret: env.DAILY_MASTER_SECRET,
    dailyOffsetMinutes: offset,
    dailyEpoch: env.DAILY_EPOCH ?? DEFAULT_EPOCH,
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
