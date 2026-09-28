/**
 * レート制限のアダプター（Cloudflare 固有 API はここに隔離する）
 *
 * レート制限は「乱用よけ」であって、不正対策の本体ではない（本体はサーバー検証と DB の一意制約）。
 * Cloudflare の Rate Limiting バインディングは拠点ごとの近似値なので、厳密さは求めない。
 */

export interface RateLimiter {
  /** 許可なら true */
  allow(key: string): Promise<boolean>;
}

/** 常に許可（バインディング未設定のローカル実行など） */
export const allowAll: RateLimiter = { allow: async () => true };

/** Cloudflare Rate Limiting バインディングを使う実装 */
export function cloudflareRateLimiter(binding: RateLimit | undefined): RateLimiter {
  if (!binding) return allowAll;
  return {
    async allow(key) {
      const { success } = await binding.limit({ key });
      return success;
    },
  };
}

/** メモリ上の固定ウィンドウ実装（テスト用） */
export function memoryRateLimiter(limit: number, periodMs: number, now: () => number): RateLimiter {
  const windows = new Map<string, { start: number; count: number }>();
  return {
    async allow(key) {
      const t = now();
      const w = windows.get(key);
      if (!w || t - w.start >= periodMs) {
        windows.set(key, { start: t, count: 1 });
        return true;
      }
      w.count++;
      return w.count <= limit;
    },
  };
}
