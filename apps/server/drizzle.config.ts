/**
 * drizzle-kit の設定（マイグレーション SQL の生成用）
 * 生成: pnpm --filter @chain-factory/server db:generate
 * 適用: ローカルは db:migrate:local、本番は wrangler d1 migrations apply chain-factory --remote
 */
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
});
