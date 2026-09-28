import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages などサブパスでも動くよう相対パスで出力する
  base: './',
  // PixiJS 本体が大きいため警告の閾値を上げる（フェーズ1では分割不要）
  build: { chunkSizeWarningLimit: 1500 },
});
