/// <reference types="vite/client" />

/** ビルド時の設定（.env.* またはコマンドラインで指定する。すべて公開値。秘密値は置かない） */
interface ImportMetaEnv {
  /** API の置き場所（既定は同じオリジン） */
  readonly VITE_API_BASE?: string;
  /** 'trial' で体験版 */
  readonly VITE_EDITION?: string;
  /** 製品版のストアページ */
  readonly VITE_STORE_URL?: string;
  /** Turnstile のサイトキー（公開値） */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** Cloudflare Web Analytics のトークン（公開値。空なら計測しない） */
  readonly VITE_CF_ANALYTICS_TOKEN?: string;
  /** シェア文に載せるサイトの URL */
  readonly VITE_SITE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
