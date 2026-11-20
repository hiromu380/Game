import { describe, expect, it } from 'vitest';
import type { BoutResult } from '@ichimon/sim';
import { BASHO_DAYS, decidedUntil, tallyUntil, tickerRow } from '../src/ticker';
import { autoStep, play } from '../../sim/test/play';

const bout = (day: number, winnerId: number, fusen = false): BoutResult => ({
  day,
  eastId: 1,
  westId: 2,
  winnerId,
  kimarite: 'yorikiri',
  kensho: 0,
  fusen,
});

describe('本場所の星取り（1日ずつ）', () => {
  it('取組を日ごとの印にする。取組のない日は空き', () => {
    const row = tickerRow(1, [bout(1, 1), bout(3, 2), bout(5, 1, true), bout(6, 2, true)]);
    expect(row.marks).toHaveLength(BASHO_DAYS);
    expect(row.marks.slice(0, 6)).toEqual(['win', null, 'loss', null, 'fusenWin', 'fusenLoss']);
    expect(tallyUntil(row, 2)).toEqual({ wins: 1, losses: 0 });
    expect(tallyUntil(row, 15)).toEqual({ wins: 2, losses: 2 });
  });

  it('勝ち越し・負け越しは、決まった日から出る（関取は8、幕下以下は4）', () => {
    const wins = tickerRow(
      1,
      Array.from({ length: 8 }, (_, i) => bout(i + 1, 1)),
    );
    expect(decidedUntil(wins, 7, true)).toBeNull();
    expect(decidedUntil(wins, 8, true)).toBe('kachikoshi');
    expect(decidedUntil(wins, 4, false)).toBe('kachikoshi');
    const losses = tickerRow(
      1,
      Array.from({ length: 4 }, (_, i) => bout(i * 2 + 1, 2)),
    );
    expect(decidedUntil(losses, 6, false)).toBeNull();
    expect(decidedUntil(losses, 7, false)).toBe('makekoshi');
    expect(decidedUntil(losses, 15, true)).toBeNull();
  });

  it('実際の場所: 星取りの勝ち負けが、成績と合う', () => {
    let g = play(4, 5);
    g = autoStep(g);
    for (const m of g.lastReport!.mine) {
      const t = tallyUntil(tickerRow(m.id, m.bouts), BASHO_DAYS);
      expect(t.wins).toBe(m.record.wins);
      expect(t.wins + t.losses).toBeLessThanOrEqual(m.record.wins + m.record.losses);
    }
  });
});
