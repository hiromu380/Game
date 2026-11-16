import { describe, expect, it } from 'vitest';
import {
  migrateSave,
  ranksOf,
  roleEffect,
  ROLES,
  SAVE_VERSION,
  setExempt,
  stableRoles,
  type GameState,
  type Rank,
} from '../src';
import { play } from './play';

/** 関取が1人いる部屋（いちばん上の弟子を十両にする） */
function withSekitori(): { g: GameState; ranks: Map<number, Rank>; top: number } {
  const g = play(4, 3);
  const ranks = ranksOf(g.banzuke, g.titles);
  const mine = g.rikishi.filter((r) => r.stableId === g.player.stableId);
  for (const r of mine) r.injury = 0;
  const order = new Map(g.banzuke.map((id, i) => [id, i]));
  mine.sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9));
  const top = mine[0]!.id;
  ranks.set(top, { division: 'juryo', title: null, number: 10, side: 'east' });
  return { g, ranks, top };
}

describe('部屋の役目（付け人とちゃんこ番）', () => {
  it('十両には付け人が2人。番付の上の弟子から付き、残りの幕下以下がちゃんこ番', () => {
    const { g, ranks, top } = withSekitori();
    const roles = stableRoles(g, ranks);
    expect(roles.of.get(top)).toBe('sekitori');
    const att = roles.attendants.get(top)!;
    expect(att.length + (roles.short.get(top) ?? 0)).toBe(ROLES.tsukebito.juryo);
    for (const id of att) expect(roles.serves.get(id)).toBe(top);
    const others = g.rikishi.filter(
      (r) => r.stableId === g.player.stableId && r.id !== top && !att.includes(r.id),
    );
    for (const r of others)
      expect(['chankoban', 'upper', 'exempt', 'injured']).toContain(roles.of.get(r.id));
    // 同じ入力なら同じ割り振り
    expect(stableRoles(g, ranks)).toEqual(roles);
  });

  it('幕下15枚目以内はちゃんこ番を外れる', () => {
    const { g, ranks } = withSekitori();
    const roles0 = stableRoles(g, ranks);
    const cook = [...roles0.of].find(([, x]) => x === 'chankoban')![0];
    ranks.set(cook, {
      division: 'makushita',
      title: null,
      number: ROLES.chankoExemptWithin,
      side: 'west',
    });
    expect(stableRoles(g, ranks).of.get(cook)).toBe('upper');
    ranks.set(cook, {
      division: 'makushita',
      title: null,
      number: ROLES.chankoExemptWithin + 1,
      side: 'west',
    });
    expect(['chankoban', 'tsukebito']).toContain(stableRoles(g, ranks).of.get(cook));
  });

  it('雑用を免除した弟子は付け人にもちゃんこ番にもならない。持ち回りの人が減ると1人の受け持ちが重くなる', () => {
    const { g, ranks } = withSekitori();
    const before = stableRoles(g, ranks);
    const cook = [...before.of].find(([, x]) => x === 'chankoban')![0];
    const ex = setExempt(g, cook, true);
    expect(ex.player.exempt).toEqual([cook]);
    const after = stableRoles(ex, ranks);
    expect(after.of.get(cook)).toBe('exempt');
    if (after.noCook) expect(after.chankoLoad).toBe(0);
    else expect(after.chankoLoad).toBeGreaterThanOrEqual(before.chankoLoad);
    expect(setExempt(ex, cook, false).player.exempt).toEqual([]);
    // よその部屋の力士は免除できない
    const other = g.rikishi.find((r) => r.stableId !== g.player.stableId)!;
    expect(setExempt(g, other.id, true)).toBe(g);
  });

  it('付け人は伸びて疲れる。ちゃんこ番は伸びが少し落ちて疲れる。免除はどちらもない', () => {
    const { g, ranks } = withSekitori();
    const roles = stableRoles(g, ranks);
    const pick = (role: string) => [...roles.of].find(([, x]) => x === role)?.[0];
    const tb = pick('tsukebito');
    if (tb !== undefined) {
      const e = roleEffect(roles, tb);
      expect(e.growth).toBeGreaterThan(1);
      expect(e.fatigue).toBeGreaterThan(0);
    }
    const cb = pick('chankoban')!;
    const c = roleEffect(roles, cb);
    expect(c.growth).toBeLessThan(1);
    expect(c.fatigue).toBeGreaterThan(0);
  });

  it('20版のセーブは、免除なしで読める', () => {
    const old = JSON.parse(JSON.stringify(play(3, 1))) as Record<string, unknown>;
    old.version = 20;
    delete (old.player as Record<string, unknown>).exempt;
    const m = migrateSave(old)!;
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.player.exempt).toEqual([]);
  });
});
