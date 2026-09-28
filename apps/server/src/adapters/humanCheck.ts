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

/**
 * Cloudflare 公式のテスト用秘密キー。結果が決まっている（常に成功 / 常に失敗）ので、
 * 通信せずに同じ結果を返す（外部に出られない開発環境・CI でも動くように）。
 * 本番でテスト用キーを使うと人間確認が無効になるため、readConfig が警告を出す
 */
export const TURNSTILE_TEST_SECRETS = {
  alwaysPass: '1x0000000000000000000000000000000AA',
  alwaysFail: '2x0000000000000000000000000000000AA',
} as const;

/** Turnstile のサーバー側検証（siteverify API） */
export function turnstileVerifier(secretKey: string, fetchFn: typeof fetch = fetch): HumanVerifier {
  return {
    async verify(token, ip) {
      if (!token) return false;
      if (secretKey === TURNSTILE_TEST_SECRETS.alwaysPass) return true;
      if (secretKey === TURNSTILE_TEST_SECRETS.alwaysFail) return false;
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
