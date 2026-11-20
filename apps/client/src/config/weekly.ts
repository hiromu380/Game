/**
 * 週替わりチャレンジの画面の設定
 */
export const WEEKLY_UI_CONFIG = {
  /** 結果の集計中（tallying）に自動で取り直す間隔と回数の上限 */
  tallyingRetryMs: 30_000,
  tallyingRetries: 10,
  /** 過去週の切り替えに出す週の数（サーバーの保存期間と同じ） */
  pastWeeks: 12,
} as const;
