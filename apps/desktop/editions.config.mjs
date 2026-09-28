/**
 * 製品版／体験版ごとのデスクトップ版の設定（ビルド時に main プロセスへ埋め込む: scripts/build.mjs）
 *
 * App ID・API の場所・ストアの URL は環境変数で上書きする（本番のビルドは人が行う: docs/ops/steam-build.md）。
 * 開発中の既定は App ID 480（Spacewar）とローカルの API サーバー。秘密値はここに置かない。
 */
const env = process.env;
const apiOrigin = env.API_ORIGIN ?? 'http://localhost:8787';
const fullGameAppId = Number(env.STEAM_APP_ID_FULL ?? 480);
const storeUrl = env.STORE_URL ?? `https://store.steampowered.com/app/${fullGameAppId}/`;
const siteUrl = env.SITE_URL ?? '';

/** 既定のブラウザで開いてよい URL（X の投稿画面・Steam ストア・公式サイトの規約ページ） */
const externalAllowList = [
  'https://x.com/intent/post',
  'https://store.steampowered.com/',
  ...(siteUrl ? [`${siteUrl.replace(/\/$/, '')}/`] : []),
];

export const EDITIONS = {
  full: {
    edition: 'full',
    steamAppId: fullGameAppId,
    fullGameAppId,
    restartThroughSteam: env.STEAM_RESTART === '1',
    ticketIdentity: env.STEAM_TICKET_IDENTITY ?? 'chain-factory-api',
    apiOrigin,
    externalAllowList,
    storeUrl,
    dataFolder: 'Chain Factory',
    // 体験版のセーブを引き継ぐときに読むフォルダ（体験版の dataFolder と同じ名前）
    demoDataFolder: 'Chain Factory Demo',
  },
  demo: {
    edition: 'demo',
    steamAppId: Number(env.STEAM_APP_ID_DEMO ?? 480),
    fullGameAppId,
    restartThroughSteam: env.STEAM_RESTART === '1',
    ticketIdentity: env.STEAM_TICKET_IDENTITY ?? 'chain-factory-api',
    apiOrigin,
    externalAllowList,
    storeUrl,
    // 体験版のセーブは製品版と別のフォルダ（混ざらないように。引き継ぎは製品版が読み込む）
    dataFolder: 'Chain Factory Demo',
    demoDataFolder: null,
  },
};
