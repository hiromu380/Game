/**
 * 能力のランクと総合力（純粋関数。画面の目安）
 * 境目は、番付ごとの能力の分布を自動プレイで測って決めた（幕内の中央値が B、横綱が A〜S。docs/balance-log.md）
 */
import type { Abilities } from '@ichimon/sim';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

/** 能力（0〜100）の下限ごとのランク（上から順に見る） */
export const GRADE_FLOORS: readonly (readonly [Grade, number])[] = [
  ['S', 85],
  ['A', 75],
  ['B', 65],
  ['C', 55],
  ['D', 45],
  ['E', 35],
  ['F', 0],
];

export function gradeOf(ability: number): Grade {
  return GRADE_FLOORS.find(([, floor]) => ability >= floor)![0];
}

/** 総合力: 得意な能力を重く見る（いちばん高い能力 ×2 ＋ ほかの2つ）÷ 4 */
export function overallOf(a: Abilities): number {
  const best = Math.max(a.oshi, a.yotsu, a.waza);
  return (best * 2 + (a.oshi + a.yotsu + a.waza - best)) / 4;
}
