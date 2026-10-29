import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // サブパスでも動くよう相対パスで出力する
  base: './',
});
