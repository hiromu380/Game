/// <reference types="vite/client" />

/** ビルド時の設定（.env.* またはコマンドラインで指定する。すべて公開値。秘密値は置かない） */
interface ImportMetaEnv {
  /** API の置き場所（既定は同じオリジン） */
  readonly VITE_API_BASE?: string;
  /** 'demo' で体験版（既定は製品版 'full'） */
  readonly VITE_EDITION?: string;
  /** 製品版のストアページ */
  readonly VITE_STORE_URL?: string;
  /** Turnstile のサイトキー（公開値） */
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  /** Cloudflare Web Analytics のトークン（公開値。空なら計測しない） */
  readonly VITE_CF_ANALYTICS_TOKEN?: string;
  /** シェア文に載せるサイトの URL */
  readonly VITE_SITE_URL?: string;
  /** '1' で撮影モード（ストア用の画像・動画の撮影用。製品版・体験版の通常ビルドには含めない） */
  readonly VITE_CAPTURE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
