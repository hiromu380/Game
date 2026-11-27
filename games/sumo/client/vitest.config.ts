import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'ichimon-client',
    include: ['test/**/*.test.ts'],
    // 何十場所も遊ぶテストがあり、全体を並列で走らせると重くなる
    testTimeout: 30_000,
  },
});
