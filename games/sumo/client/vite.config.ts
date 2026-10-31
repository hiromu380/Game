import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// mode "single": 1つの HTML にすべてをまとめる版（claude.ai のページとして載せる・スマホのアプリで開く用）。
// 絵・フォント・後から読む 3D の部分も、ファイルを分けずに埋め込む
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // サブパスでも動くよう相対パスで出力する
  base: './',
  build: {
    // 少し古いスマホ（iOS 14 の Safari など）でも動くように
    target: ['es2020', 'safari14', 'chrome90'],
    ...(mode === 'single'
      ? {
          outDir: 'dist-single',
          assetsInlineLimit: Number.MAX_SAFE_INTEGER,
          cssCodeSplit: false,
          rolldownOptions: { output: { inlineDynamicImports: true } },
        }
      : {}),
  },
}));
