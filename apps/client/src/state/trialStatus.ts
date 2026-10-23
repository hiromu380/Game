/**
 * 試運転の結果の状態（画面に出す目安。純粋関数）
 *
 * - none: このシフトでまだ試運転していない
 * - fresh: 今の盤面で試運転した結果がある（同じ盤面で何度か試したら、最小〜最大も出す）
 * - stale: 試運転の後に盤面・床を変えた（表示中の結果は変更前の盤面のもの）
 * 盤面にランダムに動くパーツ（ポンコツロボ）があるときは random: true（本番の成功は保証しない）
 */
import { getCurrentFloor, type RunState, type Score } from '@chain-factory/sim';

/** 試運転の記録（同じシフト・同じ盤面のあいだ、結果を積み上げる） */
export interface TrialRecord {
  shiftIndex: number;
  /** 試運転した盤面と床（変わったかを比べる） */
  layoutKey: string;
  /** 結果の出荷量（scoreToString の文字列。試した順） */
  scores: string[];
}

export type TrialStatus =
  | { kind: 'none' }
  | {
      kind: 'fresh' | 'stale';
      /** 直近の出荷量 */
      last: bigint;
      /** 同じ盤面で試した回数と、出荷量の最小・最大 */
      count: number;
      min: bigint;
      max: bigint;
      /** 盤面にランダムに動くパーツがあるか（結果は毎回変わる） */
      random: boolean;
    };

/** 盤面と床の組み合わせ（試運転の後に変わったかを比べる） */
export function layoutKey(run: RunState): string {
  return JSON.stringify([run.board.cells, getCurrentFloor(run)]);
}

/** 試運転したら記録する（同じシフト・同じ盤面なら結果を足し、違えば新しく始める） */
export function recordTrial(
  record: TrialRecord | null,
  run: RunState,
  score: Score | bigint,
): TrialRecord {
  const key = layoutKey(run);
  const same = record && record.shiftIndex === run.shiftIndex && record.layoutKey === key;
  return {
    shiftIndex: run.shiftIndex,
    layoutKey: key,
    scores: [...(same ? record.scores : []), score.toString()],
  };
}

/** 今の盤面に対する試運転の状態 */
export function trialStatus(record: TrialRecord | null, run: RunState): TrialStatus {
  if (!record || record.shiftIndex !== run.shiftIndex || record.scores.length === 0) {
    return { kind: 'none' };
  }
  const values = record.scores.map((s) => BigInt(s));
  return {
    kind: record.layoutKey === layoutKey(run) ? 'fresh' : 'stale',
    last: values.at(-1)!,
    count: values.length,
    min: values.reduce((a, b) => (b < a ? b : a)),
    max: values.reduce((a, b) => (b > a ? b : a)),
    random: run.board.cells.some((c) => c?.id === 'junkbot'),
  };
}

/** ノルマに対する割合（0〜1。ゲージの幅。超えても 1 で止める）。ゲージの値はここで一元的に計算する */
export function quotaRatio(score: bigint, quota: number): number {
  if (quota <= 0) return 1;
  if (score >= BigInt(quota)) return 1;
  // 大きな数でも誤差が出ないよう、千分率で割ってから戻す
  return Number((score * 1000n) / BigInt(quota)) / 1000;
}
