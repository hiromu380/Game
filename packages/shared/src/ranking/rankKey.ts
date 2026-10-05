/**
 * 週替わりチャレンジのランキングの並び順（暫定・確定とも同じ）
 *
 * ①クリアしたシフト数（多い順）→ ②合計出荷量（多い順）→ ③提出時刻（早い順）
 * サーバーの DB クエリ（ORDER BY）とこの関数は同じ順でなければならない（テストで確認する）。
 */
import { compareScoreColumns, type ScoreColumns } from '../score/columns';

export interface RankKey {
  shiftsCleared: number;
  score: ScoreColumns;
  /** 提出時刻（UNIX ミリ秒） */
  submittedAt: number;
}

/** a が b より上位なら負、下位なら正（Array.sort にそのまま渡せる） */
export function compareRankKey(a: RankKey, b: RankKey): number {
  if (a.shiftsCleared !== b.shiftsCleared) return b.shiftsCleared - a.shiftsCleared;
  const byScore = compareScoreColumns(b.score, a.score);
  if (byScore !== 0) return byScore;
  return a.submittedAt - b.submittedAt;
}

/**
 * 「上位○%」（1〜100 の整数。小さいほど上位）
 * rank は1始まりの順位、total は参加人数
 */
export function topPercent(rank: number, total: number): number {
  if (total <= 0) return 100;
  return Math.max(1, Math.ceil((rank / total) * 100));
}
