import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { htmlMetaPlugin } from './build/htmlMetaPlugin.ts';
import { serviceWorkerPlugin } from './build/serviceWorkerPlugin.ts';

export default defineConfig(({ mode }) => {
  // VITE_ で始まる公開の設定だけを読む（.env.* とコマンドラインの環境変数）
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), htmlMetaPlugin(env), serviceWorkerPlugin()],
    // サブパスでも動くよう相対パスで出力する
    base: './',
    // ゲーム本体（PixiJS を含む）は遅延読み込みのチャンクに分かれる（src/boot/loadGame.ts）
    build: {
      chunkSizeWarningLimit: 800,
      // フォントは data: URL に埋め込まない（CSP の font-src 'self' で拒否されるため。Web 版・デスクトップ版とも）
      assetsInlineLimit: (file: string) => (/\.(woff2?|ttf)$/.test(file) ? false : undefined),
    },
    // 開発時は /api を wrangler dev（apps/server）へ転送する。本番は同じオリジンで配信するので不要
    server: { proxy: { '/api': 'http://localhost:8787' } },
  };
});
