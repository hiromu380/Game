import { describe, expect, it } from 'vitest';
import {
  advanceBasho,
  createGame,
  danpatsuPlan,
  danpatsuTier,
  hasamiCount,
  type Alumnus,
  type GameState,
  type Rank,
} from '../src';

const OZEKI: Rank = { division: 'makuuchi', title: 'O', number: 1, side: 'east' };
const JURYO: Rank = { division: 'juryo', title: null, number: 5, side: 'west' };

function alumnus(
  s: GameState,
  opts: { id: number; top: Rank | null; sekitoriBasho: number; at: number },
): Alumnus {
  const r = s.rikishi[0]!;
  return {
    id: opts.id,
    name: `元弟子${opts.id}`,
    retiredAge: 33,
    retiredBashoIndex: opts.at,
    generation: 1,
    becameOyakata: false,
    foreign: false,
    career: { ...r.career, highestRank: opts.top, sekitoriBasho: opts.sekitoriBasho },
    track: [],
  };
}

describe('引退相撲・断髪式', () => {
  const s = createGame({ seed: 5 });

  it('関取30場所以上は国技館で、引退から半年ほど後の東京場所の後', () => {
    for (let at = 0; at < 12; at++) {
      const p = danpatsuPlan(alumnus(s, { id: 1, top: OZEKI, sekitoriBasho: 40, at }))!;
      expect(p.venue).toBe('kokugikan');
      expect(p.bashoIndex - at).toBeGreaterThanOrEqual(3);
      expect(p.bashoIndex - at).toBeLessThanOrEqual(4);
      expect([0, 2, 4]).toContain(p.bashoIndex % 6);
    }
  });

  it('関取30場所未満はホテルで次の場所の後。関取でなければ行わない', () => {
    const p = danpatsuPlan(alumnus(s, { id: 2, top: JURYO, sekitoriBasho: 5, at: 7 }))!;
    expect(p).toEqual({ bashoIndex: 8, venue: 'hotel' });
    const lower: Rank = { division: 'makushita', title: null, number: 3, side: 'east' };
    expect(danpatsuPlan(alumnus(s, { id: 3, top: lower, sekitoriBasho: 0, at: 7 }))).toBeNull();
  });

  it('はさみの人数は地位で増え、力士ごとに決まる', () => {
    const o = alumnus(s, { id: 4, top: OZEKI, sekitoriBasho: 40, at: 0 });
    const j = alumnus(s, { id: 4, top: JURYO, sekitoriBasho: 40, at: 0 });
    expect(danpatsuTier(o)).toBe('O');
    expect(hasamiCount(o, 'kokugikan')).toBeGreaterThan(hasamiCount(j, 'kokugikan'));
    expect(hasamiCount(o, 'hotel')).toBeLessThan(hasamiCount(o, 'kokugikan'));
    expect(hasamiCount(o, 'kokugikan')).toBe(hasamiCount(o, 'kokugikan'));
  });

  it('その場所の後に行い、名声・会員・タニマチの関係が上がり、日誌と結果に残る', () => {
    const g: GameState = JSON.parse(JSON.stringify(s));
    // 次に進める場所（bashoIndex）で行う予定の元大関
    const a = alumnus(g, { id: 99_001, top: OZEKI, sekitoriBasho: 40, at: g.bashoIndex - 3 });
    while (danpatsuPlan(a)!.bashoIndex > g.bashoIndex) a.retiredBashoIndex--;
    expect(danpatsuPlan(a)!.bashoIndex).toBe(g.bashoIndex);
    g.player.alumni.push(a);
    const before = advanceBasho(s);
    const after = advanceBasho(g);
    const d = after.lastReport!.danpatsu!;
    expect(d).toHaveLength(1);
    expect(d[0]!.venue).toBe('kokugikan');
    expect(d[0]!.hasami).toBe(hasamiCount(a, 'kokugikan'));
    expect(d[0]!.patrons.length).toBeGreaterThan(0);
    expect(after.player.prestige).toBeGreaterThan(before.player.prestige);
    expect(after.player.koenkai.patrons[0]!.favor).toBeGreaterThan(
      before.player.koenkai.patrons[0]!.favor,
    );
    expect(after.journal.some((e) => e.kind === 'danpatsu')).toBe(true);
    expect(before.lastReport!.danpatsu).toBeUndefined();
    // 次の場所では行わない
    expect(advanceBasho(after).lastReport!.danpatsu).toBeUndefined();
  });
});
