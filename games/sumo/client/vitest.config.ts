import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'ichimon-client',
    include: ['test/**/*.test.ts'],
  },
});
