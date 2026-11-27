import { describe, expect, it } from 'vitest';
import { advanceBasho, createGame, HONMEI, migrateSave, setHonmei, type GameState } from '../src';

describe('本命（応援予想）', () => {
  it('自分の弟子だけ選べて、外せる', () => {
    const g = createGame({ seed: 21 });
    const mine = g.rikishi.find((r) => r.stableId === g.player.stableId)!;
    const other = g.rikishi.find((r) => r.stableId !== g.player.stableId)!;
    expect(setHonmei(g, other.id).player.honmei).toBeNull();
    const a = setHonmei(g, mine.id);
    expect(a.player.honmei).toBe(mine.id);
    expect(setHonmei(a, null).player.honmei).toBeNull();
  });

  it('勝ち越せば名声が上がり、外れても下がらない。本命は次の場所にも残る', () => {
    let hits = 0;
    let misses = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const g0 = createGame({ seed });
      const mine = g0.rikishi.find((r) => r.stableId === g0.player.stableId)!;
      const g = setHonmei(g0, mine.id);
      const with_ = advanceBasho(g);
      const without = advanceBasho(g0);
      const h = with_.lastReport!.honmei;
      expect(h?.id).toBe(mine.id);
      const diff = with_.player.prestige - without.player.prestige;
      if (h!.hit) {
        hits++;
        expect(diff).toBeCloseTo(HONMEI.prestige);
      } else {
        misses++;
        expect(diff).toBeCloseTo(0);
      }
      if (with_.rikishi.some((r) => r.id === mine.id && r.stableId === g0.player.stableId))
        expect(with_.player.honmei).toBe(mine.id);
    }
    expect(hits + misses).toBe(12);
  });

  it('版28のセーブは本命なしで読む', () => {
    const old = JSON.parse(JSON.stringify(createGame({ seed: 1 }))) as GameState & {
      version: number;
    };
    delete (old.player as Partial<GameState['player']>).honmei;
    old.version = 28;
    const m = migrateSave(old)!;
    expect(m.version).toBe(29);
    expect(m.player.honmei).toBeNull();
  });
});
