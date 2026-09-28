/**
 * 人間確認（Cloudflare Turnstile）のアダプター
 *
 * 匿名 ID の発行時にだけ使う（大量の ID 生成で相場・ランキングを荒らされないように）。
 * Cloudflare 固有の API はここに閉じ込め、ドメインは HumanVerifier だけを見る。
 *
 * ローカル開発・テストは Cloudflare 公式のテスト用キーを使う（.dev.vars.example 参照）:
 *   サイトキー 1x00000000000000000000AA / 秘密キー 1x0000000000000000000000000000000AA … 常に成功
 */

export interface HumanVerifier {
  /** 人間確認のトークンが有効なら true */
  verify(token: string, ip: string | null): Promise<boolean>;
}

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/** Turnstile のサーバー側検証（siteverify API） */
export function turnstileVerifier(secretKey: string, fetchFn: typeof fetch = fetch): HumanVerifier {
  return {
    async verify(token, ip) {
      if (!token) return false;
      const form = new FormData();
      form.append('secret', secretKey);
      form.append('response', token);
      if (ip) form.append('remoteip', ip);
      try {
        const res = await fetchFn(SITEVERIFY_URL, { method: 'POST', body: form });
        const json = (await res.json()) as { success?: boolean };
        return json.success === true;
      } catch {
        // 検証サービスに届かないときは通さない（ID 発行は急ぎではないので、安全側に倒す）
        return false;
      }
    },
  };
}

/** 常に通す（テスト用） */
export const alwaysHuman: HumanVerifier = { verify: async () => true };
