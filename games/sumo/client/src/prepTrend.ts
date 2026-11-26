/**
 * 弟子の場所ごとの稽古の伸びの推移（純粋関数）。弟子のカードの小さな棒グラフに使う。
 * 棒は「その場所前の4週で伸びた量」、棒の下はその場所の成績（全休・勝ち越し・負け越しのどれか1つ）。
 * 今の場所前の週が進んでいれば、いちばん右に「今」の棒（成績はまだない）
 */
import type { TrackEntry } from '@ichimon/sim';
import { outcomeOf, type Outcome } from './prepPayoff';

export interface TrendBar {
  /** 場所の番号（今の場所前は null） */
  bashoIndex: number | null;
  gain: number;
  outcome: Outcome | null;
}

/** グラフに並べる場所の数（いちばん新しいものから） */
export const TREND_MAX = 12;

export function prepTrend(
  track: readonly TrackEntry[],
  now: number | null,
  max = TREND_MAX,
): TrendBar[] {
  const bars: TrendBar[] = track
    .filter((e) => e.prep !== undefined)
    .map((e) => ({ bashoIndex: e.bashoIndex, gain: e.prep!, outcome: outcomeOf(e) }));
  if (now !== null) bars.push({ bashoIndex: null, gain: now, outcome: null });
  return bars.slice(-max);
}
