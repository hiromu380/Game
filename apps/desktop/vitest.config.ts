import { defineConfig } from 'vitest/config';

// メインプロセスの処理のうち、Electron に依存しない部分（検証・保存・セキュリティ・Steam アダプター）をテストする
export default defineConfig({
  test: {
    name: 'desktop',
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
