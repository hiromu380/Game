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
  /** 登録時の IP の HMAC（生の IP は保存しない）。保存期間を過ぎたらジョブが null にする */
  registeredIpHash: text('registered_ip_hash'),
});

/**
 * 外部 ID（Steam など）とプレイヤーの対応
 * 外部 ID そのもの（SteamID）は個人を特定しうるので保存せず、マスター秘密鍵つきの HMAC だけを持つ
 */
export const externalAccounts = sqliteTable(
  'external_accounts',
  {
    /** 'steam' */
    provider: text('provider').notNull(),
    subjectHash: text('subject_hash').notNull(),
    playerId: text('player_id').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.provider, t.subjectHash] })],
);

/**
 * 週替わりチャレンジの週（1週1行）
 * 先行生成ジョブが「相場を入れる前の設定」で作り、公開前に自動検証する。週の切り替えで相場を入れて確定する
 */
export const weeks = sqliteTable('weeks', {
  /** 週の ID（週の始まりの日 'YYYY-MM-DD'） */
  id: text('id').primaryKey(),
  number: integer('number').notNull(),
  /** 盤面の候補番号（自動検証で不合格なら進める） */
  candidate: integer('candidate').notNull(),
  /** 1 なら固定の代替設定（引き直しの上限に達した） */
  fallback: integer('fallback').notNull(),
  /** 検証の進み具合（JSON。domain/weekly/weeks.ts の VerifyProgress） */
  verifyJson: text('verify_json').notNull(),
  /** 'pending' | 'verified' | 'fallback' */
  verifyState: text('verify_state').notNull(),
  /** 相場を入れる前の RunConfig の JSON */
  baseConfigJson: text('base_config_json').notNull(),
  /** 相場を入れて確定した RunConfig の JSON（週の切り替えで入る。それまでは null） */
  configJson: text('config_json'),
  /** 相場: 'pending'（まだ）| 'market'（前週の購入率から）| 'base'（基準価格。相場のジョブが失敗したとき） */
  marketState: text('market_state').notNull(),
  seedCommitment: text('seed_commitment').notNull(),
  simVersion: text('sim_version').notNull(),
  opensAt: integer('opens_at').notNull(),
  closesAt: integer('closes_at').notNull(),
});

/** その日の挑戦の進行状況（1日1回を主キーで保証する） */
export const weeklyAttempts = sqliteTable(
  'weekly_attempts',
  {
    weekId: text('week_id').notNull(),
    dayId: text('day_id').notNull(),
    playerId: text('player_id').notNull(),
    /** シフトごとの操作ログ（RunOp[][] の JSON）。不正の検出・結果発表のリプレイに使う */
    opsJson: text('ops_json').notNull(),
    shiftIndex: integer('shift_index').notNull(),
    /** 'playing' | 'finished' */
    status: text('status').notNull(),
    startedAt: integer('started_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.weekId, t.dayId, t.playerId] }),
    index('weekly_attempts_player').on(t.weekId, t.playerId),
  ],
);

/** 挑戦ごとの成績（スコアは桁数・先頭15桁・全桁の文字列の3列: packages/shared/src/score/columns.ts） */
export const weeklyAttemptResults = sqliteTable(
  'weekly_attempt_results',
  {
    weekId: text('week_id').notNull(),
    dayId: text('day_id').notNull(),
    playerId: text('player_id').notNull(),
    shiftsCleared: integer('shifts_cleared').notNull(),
    scoreDigits: integer('score_digits').notNull(),
    scoreHead: integer('score_head').notNull(),
    scoreText: text('score_text').notNull(),
    maxChain: integer('max_chain').notNull(),
    submittedAt: integer('submitted_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.weekId, t.dayId, t.playerId] })],
);

/** その週のベスト（ランキング用。参加日数つき） */
export const weeklyBests = sqliteTable(
  'weekly_bests',
  {
    weekId: text('week_id').notNull(),
    playerId: text('player_id').notNull(),
    /** ベストを出した日 */
    dayId: text('day_id').notNull(),
    shiftsCleared: integer('shifts_cleared').notNull(),
    scoreDigits: integer('score_digits').notNull(),
    scoreHead: integer('score_head').notNull(),
    scoreText: text('score_text').notNull(),
    maxChain: integer('max_chain').notNull(),
    submittedAt: integer('submitted_at').notNull(),
    daysPlayed: integer('days_played').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.weekId, t.playerId] }),
    // ランキングの並び順そのままのインデックス
    index('weekly_bests_rank').on(
      t.weekId,
      t.shiftsCleared,
      t.scoreDigits,
      t.scoreHead,
      t.scoreText,
      t.submittedAt,
    ),
  ],
);

/**
 * 確定した順位（結果発表。週の切り替えジョブが書く）
 * 表示名・非表示フラグは焼き込まず、表示のときに players から読む
 */
export const weeklyStandings = sqliteTable(
  'weekly_standings',
  {
    weekId: text('week_id').notNull(),
    playerId: text('player_id').notNull(),
    rank: integer('rank').notNull(),
    /** 上位○% × 1000（整数） */
    topPercentMilli: integer('top_percent_milli').notNull(),
    dayId: text('day_id').notNull(),
    shiftsCleared: integer('shifts_cleared').notNull(),
    scoreDigits: integer('score_digits').notNull(),
    scoreHead: integer('score_head').notNull(),
    scoreText: text('score_text').notNull(),
    maxChain: integer('max_chain').notNull(),
    submittedAt: integer('submitted_at').notNull(),
    daysPlayed: integer('days_played').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.weekId, t.playerId] }),
    index('weekly_standings_rank').on(t.weekId, t.rank),
  ],
);

/** 結果の確定の進み具合（続きから再開できるように） */
export const weeklyFinalizations = sqliteTable('weekly_finalizations', {
  weekId: text('week_id').primaryKey(),
  total: integer('total').notNull(),
  processed: integer('processed').notNull(),
  /** 確定が終わった時刻（終わるまでは null） */
  finishedAt: integer('finished_at'),
});

/** ショップの提示・購入数（相場計算の材料。週替わりのランク対象の挑戦だけ数える） */
export const shopStats = sqliteTable(
  'shop_stats',
  {
    weekId: text('week_id').notNull(),
    partId: text('part_id').notNull(),
    offered: integer('offered').notNull(),
    bought: integer('bought').notNull(),
  },
  (t) => [primaryKey({ columns: [t.weekId, t.partId] })],
);

/** その週の相場（週の切り替えで確定し、週の間は固定） */
export const marketPrices = sqliteTable(
  'market_prices',
  {
    /** 相場が適用される週の ID */
    weekId: text('week_id').notNull(),
    partId: text('part_id').notNull(),
    /** 倍率 × 1000 */
    multiplierMilli: integer('multiplier_milli').notNull(),
    price: integer('price').notNull(),
  },
  (t) => [primaryKey({ columns: [t.weekId, t.partId] })],
);
