import { defineConfig } from 'vitest/config';

// 描画を含まない純粋なロジック（再生制御・セーブ・i18n）のみテストする
export default defineConfig({
  test: {
    name: 'client',
    include: ['test/**/*.test.ts'],
    environment: 'node',
  },
});
