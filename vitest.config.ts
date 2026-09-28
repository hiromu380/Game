import { defineConfig } from 'vitest/config';

// ルートで `pnpm test` を実行すると全パッケージのテストをまとめて走らせる
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
  },
});
