import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'bots',
    include: ['test/**/*.test.ts'],
    // ボットは simulate を大量に呼ぶので、既定より長めに待つ
    testTimeout: 60_000,
  },
});
