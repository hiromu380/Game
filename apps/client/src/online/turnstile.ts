/**
 * Cloudflare Turnstile（人間確認）のスクリプト読み込み
 *
 * 匿名 ID の発行時にだけ使う。スクリプトは必要になったときに初めて読み込む
 * （通常ランしか遊ばない人には外部スクリプトを読み込ませない）。
 * サイトキーは公開値（VITE_TURNSTILE_SITE_KEY）。開発時は .env.development の公式テスト用キーを使う。
 */

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export const TURNSTILE_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? '';

/**
 * Cloudflare 公式のテスト用サイトキー（常に成功）。このキーのときはスクリプトを読み込まず、
 * 公式のダミートークンをそのまま使う（外部に出られない開発環境でも登録できるように。
 * サーバー側もテスト用秘密キーなら通信せずに成功を返す: apps/server/src/adapters/humanCheck.ts）
 */
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
export const TURNSTILE_DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';

/** Turnstile のスクリプトが公開する API（使う部分だけ） */
export interface TurnstileApi {
  render(
    container: HTMLElement,
    options: {
      sitekey: string;
      callback: (token: string) => void;
      'error-callback'?: () => void;
      'expired-callback'?: () => void;
      theme?: 'light' | 'dark' | 'auto';
      language?: string;
    },
  ): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | null = null;

/** スクリプトを読み込む（何度呼んでも1回だけ） */
export function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile'));
    script.onerror = () => {
      loading = null; // 次に開いたときにもう一度試せるように
      reject(new Error('turnstile'));
    };
    document.head.appendChild(script);
  });
  return loading;
}
