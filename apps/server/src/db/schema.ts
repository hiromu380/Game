/**
 * DB スキーマ（Drizzle）
 *
 * D1 固有・SQLite 固有の機能には依存しない（CLAUDE.md「AWS移行を見据えたルール」）:
 * - 型は text / integer のみ。日時は UNIX ミリ秒の整数、JSON は text に文字列で入れる
 * - 並び順・一意性は通常の主キー・インデックスだけで表現する
 *
 * マイグレーションは `pnpm --filter @chain-factory/server db:generate` で src/db/migrations に生成する。
 */
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** プレイヤー（匿名。端末に保存したトークンで本人確認する） */
export const players = sqliteTable('players', {
  id: text('id').primaryKey(),
  /** トークンそのものは保存せず、SHA-256 のハッシュだけを持つ */
  tokenHash: text('token_hash').notNull(),
  displayName: text('display_name').notNull(),
  /** 1 ならランキングに出さない（管理用） */
  hidden: integer('hidden').notNull().default(0),
  createdAt: integer('created_at').notNull(),
});

/** デイリーチャレンジ（1日1行。生成ジョブが前日までに作る） */
export const dailies = sqliteTable('dailies', {
  /** 'YYYY-MM-DD' */
  id: text('id').primaryKey(),
  number: integer('number').notNull(),
  /** RunConfig の JSON（その日の相場価格・特別ルールを含む） */
  configJson: text('config_json').notNull(),
  seedCommitment: text('seed_commitment').notNull(),
  simVersion: text('sim_version').notNull(),
  opensAt: integer('opens_at').notNull(),
  closesAt: integer('closes_at').notNull(),
});

/** デイリーの進行状況（1日1回を主キーで保証する） */
export const dailySessions = sqliteTable(
  'daily_sessions',
  {
    dailyId: text('daily_id').notNull(),
    playerId: text('player_id').notNull(),
    /** シフトごとの操作ログ（RunOp[][] の JSON） */
    opsJson: text('ops_json').notNull(),
    shiftIndex: integer('shift_index').notNull(),
    /** 'playing' | 'finished' */
    status: text('status').notNull(),
    ranked: integer('ranked').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.dailyId, t.playerId] })],
);

/**
 * デイリーの結果（ランキング用）
 * スコアは桁数・先頭15桁・全桁の文字列の3列（packages/shared/src/score/columns.ts）
 */
export const dailyResults = sqliteTable(
  'daily_results',
  {
    dailyId: text('daily_id').notNull(),
    playerId: text('player_id').notNull(),
    shiftsCleared: integer('shifts_cleared').notNull(),
    scoreDigits: integer('score_digits').notNull(),
    scoreHead: integer('score_head').notNull(),
    scoreText: text('score_text').notNull(),
    maxChain: integer('max_chain').notNull(),
    submittedAt: integer('submitted_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.dailyId, t.playerId] }),
    // ランキングの並び順そのままのインデックス
    index('daily_results_rank').on(
      t.dailyId,
      t.shiftsCleared,
      t.scoreDigits,
      t.scoreHead,
      t.scoreText,
      t.submittedAt,
    ),
  ],
);

/** ショップの提示・購入数（相場計算の材料。ランク対象のランだけ数える） */
export const shopStats = sqliteTable(
  'shop_stats',
  {
    dailyId: text('daily_id').notNull(),
    partId: text('part_id').notNull(),
    offered: integer('offered').notNull(),
    bought: integer('bought').notNull(),
  },
  (t) => [primaryKey({ columns: [t.dailyId, t.partId] })],
);

/** その日の相場（相場ジョブが作る） */
export const marketPrices = sqliteTable(
  'market_prices',
  {
    /** 相場が適用される日（'YYYY-MM-DD'） */
    date: text('date').notNull(),
    partId: text('part_id').notNull(),
    /** 倍率 × 1000 */
    multiplierMilli: integer('multiplier_milli').notNull(),
    price: integer('price').notNull(),
  },
  (t) => [primaryKey({ columns: [t.date, t.partId] })],
);
