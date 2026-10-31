import { describe, expect, it } from 'vitest';
import { canScout, createGame, migrateSave, scoutTrip, type GameState } from '../src';

function at(bashoIndex: number, seed = 1): GameState {
  const s = createGame({ seed });
  s.bashoIndex = bashoIndex;
  s.pending.candidates = [];
  return s;
}

describe('スカウト回り', () => {
  it('時期が決まっている: 中学・高校の大会は秋場所の前、学生相撲は初場所の前。地方はいつでも', () => {
    expect(canScout(at(4), 'interHigh')).toBe(true);
    expect(canScout(at(2), 'interHigh')).toBe(false);
    expect(canScout(at(6), 'collegeMeet')).toBe(true);
    expect(canScout(at(5), 'collegeMeet')).toBe(false);
    expect(canScout(at(2), 'countryside')).toBe(true);
  });

  it('出向くと費用を払い、その経歴の入門希望者が加わる。1つの場所に1回だけ', () => {
    const s = at(4);
    const next = scoutTrip(s, 'interHigh');
    expect(next.player.stableMoney).toBe(s.player.stableMoney - 400_000);
    expect(next.pending.candidates.length).toBeGreaterThanOrEqual(1);
    for (const c of next.pending.candidates) {
      expect(c.background).toBe('highSchool');
      expect(c.age).toBe(18);
    }
    expect(next.journal.at(-1)).toMatchObject({ kind: 'scout', trip: 'interHigh' });
    expect(scoutTrip(next, 'countryside')).toBe(next);
  });

  it('海外は外国出身が1人。部屋に外国出身がいれば行けない', () => {
    const s = at(2);
    const next = scoutTrip(s, 'overseas');
    expect(next.pending.candidates).toHaveLength(1);
    expect(next.pending.candidates[0]!.foreign).toBe(true);
    const t = at(2);
    t.rikishi.find((r) => r.stableId === t.player.stableId)!.foreign = true;
    expect(canScout(t, 'overseas')).toBe(false);
  });

  it('お金が足りなければ行けない。同じ状態なら同じ子に会う', () => {
    const s = at(4);
    s.player.stableMoney = 100_000;
    expect(canScout(s, 'interHigh')).toBe(false);
    expect(scoutTrip(at(4, 3), 'juniorHighMeet').pending.candidates).toEqual(
      scoutTrip(at(4, 3), 'juniorHighMeet').pending.candidates,
    );
  });

  it('版15のセーブを読む', () => {
    const v = JSON.parse(JSON.stringify(createGame({ seed: 1 })));
    v.version = 15;
    delete v.player.scoutedAt;
    const m = migrateSave(v)!;
    expect(m.version).toBe(17);
    expect(m.player.scoutedAt).toBeNull();
  });
});
