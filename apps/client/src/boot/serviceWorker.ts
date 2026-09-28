/**
 * Service Worker の登録（PWA: ホーム画面に追加でき、通常ランはオフラインでも遊べる）
 *
 * 本番ビルドだけで登録する（開発中はキャッシュが邪魔になるため）。
 * sw.js はビルド時に vite.config.ts のプラグインが生成する（キャッシュするファイルの一覧入り）。
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // 登録できなくても、オンラインでは普通に遊べる
    });
  });
}
