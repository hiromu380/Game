/**
 * 短い間だけ値を覚えておくキャッシュ（暫定ランキングの並びを 60 秒ごとに作り直すのに使う）
 *
 * ドメインはこのインターフェースだけを知る。Cloudflare の Cache API はこのファイルに閉じ込め、
 * テスト・ローカルのジョブではメモリーの実装を使う（AWS に移る場合はこのインターフェースの実装を足す）。
 */
export interface KeyValueCache {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, ttlSeconds: number): Promise<void>;
}

/** メモリーの実装（now は期限の判定に使う時計。テストでは固定の時計を渡す） */
export function memoryCache(now: () => number): KeyValueCache {
  const store = new Map<string, { value: string; expiresAt: number }>();
  return {
    async get(key) {
      const hit = store.get(key);
      if (!hit || hit.expiresAt <= now()) return null;
      return hit.value;
    },
    async put(key, value, ttlSeconds) {
      store.set(key, { value, expiresAt: now() + ttlSeconds * 1000 });
    },
  };
}

/**
 * Cloudflare Workers の Cache API の実装（データセンターごとのキャッシュ）
 * 実在しない URL をキーにして、Response として保存する
 */
export function cloudflareCache(): KeyValueCache {
  const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
  const url = (key: string) => `https://cache.chain-factory.internal/${encodeURIComponent(key)}`;
  return {
    async get(key) {
      if (!cache) return null;
      const res = await cache.match(url(key));
      return res ? res.text() : null;
    },
    async put(key, value, ttlSeconds) {
      if (!cache) return;
      await cache.put(
        url(key),
        new Response(value, { headers: { 'Cache-Control': `max-age=${ttlSeconds}` } }),
      );
    },
  };
}
