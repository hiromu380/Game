import { describe, expect, it } from 'vitest';
import type { TrackEntry } from '@ichimon/sim';
import { prepTrend } from '../src/prepTrend';

const e = (bashoIndex: number, wins: number, losses: number, prep?: number, absences = 0) =>
  ({ bashoIndex, wins, losses, absences, prep, order: 0, total: 1, yusho: false }) as TrackEntry;

describe('稽古の伸びの推移', () => {
  it('記録のない古い場所は出さず、今の場所前をいちばん右に足す', () => {
    const bars = prepTrend([e(1, 4, 3), e(2, 4, 3, 2.5), e(3, 0, 0, 0, 7), e(4, 2, 5, 0)], 1.2);
    expect(bars).toEqual([
      { bashoIndex: 2, gain: 2.5, outcome: 'kachi' },
      { bashoIndex: 3, gain: 0, outcome: 'kyujo' },
      { bashoIndex: 4, gain: 0, outcome: 'make' },
      { bashoIndex: null, gain: 1.2, outcome: null },
    ]);
  });

  it('新しい方から上限まで。場所前が始まっていなければ今の棒はない', () => {
    const track = Array.from({ length: 20 }, (_, i) => e(i, 4, 3, i));
    const bars = prepTrend(track, null, 12);
    expect(bars).toHaveLength(12);
    expect(bars[0]!.bashoIndex).toBe(8);
    expect(bars.at(-1)!.bashoIndex).toBe(19);
  });
});
