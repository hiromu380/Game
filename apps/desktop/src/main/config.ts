/**
 * デスクトップ版の設定（ビルド時に決まる値）
 *
 * scripts/build.mjs が製品版／体験版ごとの値を esbuild の define で埋め込む（実行時に書き換えられないように）。
 * 秘密値は置かない（パブリッシャーキーなどはサーバーだけが持つ）。
 */

export interface DesktopBuildConfig {
  /** 製品版か体験版か（レンダラーのビルド設定 VITE_EDITION と同じ値で作る） */
  edition: 'full' | 'demo';
  /** この版の Steam App ID（開発中は 480 = Spacewar） */
  steamAppId: number;
  /** 製品版の App ID（体験版から製品版のストアページを開くときに使う） */
  fullGameAppId: number;
  /** Steam で起動し直させるか（本番のビルドだけ true。開発中は Steam を経由せずに起動したい） */
  restartThroughSteam: boolean;
  /** サーバー認証用チケットの identity（サーバーの STEAM_TICKET_IDENTITY と同じ値） */
  ticketIdentity: string;
  /** API サーバーのオリジン（CSP の connect-src に入れる） */
  apiOrigin: string;
  /** 既定のブラウザで開いてよい URL の先頭（プレフィックス一致） */
  externalAllowList: string[];
  /** 製品版のストアページ（オーバーレイが使えないときに既定のブラウザで開く） */
  storeUrl: string;
  /** ユーザーデータのフォルダ名（%APPDATA% の下。製品版と体験版で分ける） */
  dataFolder: string;
  /** 体験版のユーザーデータのフォルダ名（製品版だけ。セーブの引き継ぎに使う。体験版では null） */
  demoDataFolder: string | null;
}

declare const __DESKTOP_CONFIG__: DesktopBuildConfig;

/** テストなど define されていない環境用の既定値（開発用の App ID 480） */
const DEV_DEFAULTS: DesktopBuildConfig = {
  edition: 'full',
  steamAppId: 480,
  fullGameAppId: 480,
  restartThroughSteam: false,
  ticketIdentity: 'chain-factory-api',
  apiOrigin: 'http://localhost:8787',
  externalAllowList: ['https://x.com/intent/post', 'https://store.steampowered.com/'],
  storeUrl: 'https://store.steampowered.com/app/480/',
  dataFolder: 'Chain Factory Dev',
  demoDataFolder: 'Chain Factory Demo Dev',
};

export const CONFIG: DesktopBuildConfig =
  typeof __DESKTOP_CONFIG__ === 'undefined' ? DEV_DEFAULTS : __DESKTOP_CONFIG__;

/** アプリのページを配信するカスタムプロトコル（file:// は使わない: CLAUDE.md「デスクトップ版」） */
export const APP_SCHEME = 'app';
export const APP_HOST = 'chain-factory';
export const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
