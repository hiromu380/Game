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
  /** デイリー #1 の日付（公開日に合わせて設定する） */
  DAILY_EPOCH?: string;
  /** CORS を許可するオリジン（カンマ区切り）。同一オリジン配信なら不要 */
  CORS_ORIGINS?: string;
  /** Turnstile の秘密キー（Secrets。ローカルはテスト用キー） */
  TURNSTILE_SECRET_KEY: string;
  /** 登録時の IP ハッシュの保存日数 */
  IP_HASH_RETENTION_DAYS?: string;
  /** Steam のパブリッシャーキー（Secrets。未設定なら Steam 認証は使えない） */
  STEAM_WEB_API_KEY?: string;
  /** Steam 認証で受け付ける App ID（カンマ区切り。製品版・体験版） */
  STEAM_APP_IDS?: string;
  /** Web API チケットの identity（デスクトップ版のビルド設定 STEAM_TICKET_IDENTITY と同じ値） */
  STEAM_TICKET_IDENTITY?: string;
}

export interface AppConfig {
  masterSecret: string;
  dailyOffsetMinutes: number;
  dailyEpoch: string;
  corsOrigins: string[];
  turnstileSecretKey: string;
  ipHashRetentionDays: number;
  steam: {
    apiKey: string | null;
    allowedAppIds: number[];
    identity: string;
  };
}

const DEFAULT_OFFSET_MINUTES = 540;
const DEFAULT_EPOCH = '2026-09-01';
const DEFAULT_IP_HASH_RETENTION_DAYS = 30;
const DEFAULT_STEAM_TICKET_IDENTITY = 'chain-factory-api';

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
  if (!env.TURNSTILE_SECRET_KEY) {
    throw new Error('TURNSTILE_SECRET_KEY must be set. See apps/server/.dev.vars.example');
  }
  if (
    env.TURNSTILE_SECRET_KEY.startsWith('1x0000') ||
    env.TURNSTILE_SECRET_KEY.startsWith('2x0000')
  ) {
    // テスト用キーは開発専用（本番で使うと人間確認が働かない）。docs/ops/deploy.md の確認項目
    console.warn('TURNSTILE_SECRET_KEY is a Cloudflare test key. Do not use it in production.');
  }
  const retention = Number(env.IP_HASH_RETENTION_DAYS ?? DEFAULT_IP_HASH_RETENTION_DAYS);
  if (!Number.isInteger(retention) || retention < 0) {
    throw new Error('IP_HASH_RETENTION_DAYS must be a non-negative integer');
  }
  const steamAppIds = (env.STEAM_APP_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
  if (steamAppIds.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error('STEAM_APP_IDS must be comma-separated positive integers');
  }
  return {
    steam: {
      apiKey: env.STEAM_WEB_API_KEY || null,
      allowedAppIds: steamAppIds,
      identity: env.STEAM_TICKET_IDENTITY || DEFAULT_STEAM_TICKET_IDENTITY,
    },
    turnstileSecretKey: env.TURNSTILE_SECRET_KEY,
    ipHashRetentionDays: retention,
    masterSecret: env.DAILY_MASTER_SECRET,
    dailyOffsetMinutes: offset,
    dailyEpoch: env.DAILY_EPOCH ?? DEFAULT_EPOCH,
    corsOrigins: (env.CORS_ORIGINS ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  };
}
