/**
 * セキュリティまわりの判定（純粋関数。Electron に依存しないのでテストできる）
 *
 * - CSP: アプリのページ（app://）に付ける。外部から読み込むのは API サーバーへの通信だけ
 *   （Web 版と違い Turnstile・Web Analytics は使わない。PixiJS は pixi.js/unsafe-eval を読み込み済みなので eval 不要）
 * - 外部リンク: 許可リストの URL だけを既定のブラウザで開く
 * - ナビゲーション: アプリのオリジン以外への遷移はすべて禁止
 */
import { APP_HOST, APP_SCHEME } from './config';

export function contentSecurityPolicy(apiOrigin: string): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    // React の style 属性・PixiJS のために inline のスタイルだけ許す（スクリプトは許さない）
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${apiOrigin}`,
    // PixiJS が画像の読み込みに blob のワーカーを使う
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join('; ');
}

/** 既定のブラウザで開いてよい URL か（https だけ・許可リストのプレフィックスに一致） */
export function isAllowedExternalUrl(url: string, allowList: readonly string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  // 正規化した URL で比べる（大文字・余計なドットなどでのすり抜けを防ぐ）
  return allowList.some((prefix) => parsed.href.startsWith(prefix));
}

/** ウィンドウ内での遷移を許すか（アプリのページどうしだけ） */
export function isAppUrl(url: string): boolean {
  try {
    // カスタムスキームでは URL.origin が "null" になるため、スキームとホストで比べる
    const parsed = new URL(url);
    return parsed.protocol === `${APP_SCHEME}:` && parsed.host === APP_HOST;
  } catch {
    return false;
  }
}
