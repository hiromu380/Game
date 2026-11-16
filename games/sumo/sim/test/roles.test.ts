import { describe, expect, it } from 'vitest';
import {
  migrateSave,
  ranksOf,
  roleEffect,
  ROLES,
  SAVE_VERSION,
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
  ranks.set(top, { division: 'juryo', title: null, number: 10, side: 'E' });
  return { g, ranks, top };
}

describe('部屋の役目（付け人とちゃんこ番）', () => {
  it('十両には付け人が2人。番付の上の弟子から付き、残りの幕下以下がちゃんこ番', () => {
    const { g, ranks, top } = withSekitori();
    const roles = stableRoles(g, ranks);
    expect(roles.of.get(top)).toBe('sekitori');
    const att = roles.attendants.get(top)!;
    // 部屋の弟子が足りなければ、そのぶん少ない（よそから借りない）
    expect(att.length).toBeLessThanOrEqual(ROLES.tsukebito.juryo);
    for (const id of att) expect(roles.serves.get(id)).toBe(top);
    const others = g.rikishi.filter(
      (r) => r.stableId === g.player.stableId && r.id !== top && !att.includes(r.id),
    );
    for (const r of others) expect(['chankoban', 'upper', 'injured']).toContain(roles.of.get(r.id));
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
      side: 'W',
    });
    expect(stableRoles(g, ranks).of.get(cook)).toBe('upper');
    ranks.set(cook, {
      division: 'makushita',
      title: null,
      number: ROLES.chankoExemptWithin + 1,
      side: 'W',
    });
    expect(['chankoban', 'tsukebito']).toContain(stableRoles(g, ranks).of.get(cook));
  });

  it('付け人は関取の稽古相手でちゃんこ番より伸び、疲れる。ちゃんこ番は伸びが少し落ちて疲れる。付け人もちゃんこ番を持ち回る', () => {
    const { g, ranks } = withSekitori();
    const roles = stableRoles(g, ranks);
    const pick = (role: string) => [...roles.of].find(([, x]) => x === role)?.[0];
    const tb = pick('tsukebito');
    if (tb !== undefined) {
      const e = roleEffect(roles, tb);
      expect(roles.cooks.has(tb)).toBe(true);
      expect(e.growth).toBeGreaterThan(roleEffect(roles, pick('chankoban') ?? tb).growth - 1e-9);
      expect(e.fatigue).toBeGreaterThan(0);
    }
    const cb = pick('chankoban')!;
    const c = roleEffect(roles, cb);
    expect(c.growth).toBeLessThan(1);
    expect(c.fatigue).toBeGreaterThan(0);
  });

  it('21版のセーブは、免除を消して読める', () => {
    const old = JSON.parse(JSON.stringify(play(3, 1))) as Record<string, unknown>;
    old.version = 21;
    (old.player as Record<string, unknown>).exempt = [1];
    const m = migrateSave(old)!;
    expect(m.version).toBe(SAVE_VERSION);
    expect('exempt' in m.player).toBe(false);
  });

  it('部屋の外で暮らす関取は疲れが抜けやすい。一人暮らしは伸びが少し落ちる', () => {
    const { g, ranks, top } = withSekitori();
    const roles = stableRoles(g, ranks);
    const base = roleEffect(roles, top, { career: { basho: 30 } } as never);
    const alone = roleEffect(roles, top, { career: { basho: 30 }, living: 'alone' } as never);
    const married = roleEffect(roles, top, { career: { basho: 30 }, living: 'married' } as never);
    expect(alone.fatigue).toBeLessThan(base.fatigue);
    expect(alone.growth).toBeLessThan(base.growth);
    expect(married.fatigue).toBeLessThan(alone.fatigue);
  });
});

describe('入門の流れ（前相撲・新序出世披露・教習所）', () => {
  it('入門した場所は前相撲で番付に載らず、場所の後に出世披露をして序ノ口に載る', async () => {
    const { acceptCandidate, advanceBasho, ranksOf: rk } = await import('../src');
    let g = play(5, 0);
    for (let i = 0; i < 20 && g.pending.candidates.length === 0; i++) g = advanceBasho(g);
    const c = g.pending.candidates[0]!;
    g.player.stableMoney = 100_000_000;
    const joined = acceptCandidate(g, c.id);
    const r = joined.rikishi.find(
      (x) => x.name === c.name && x.stableId === joined.player.stableId,
    )!;
    expect(joined.banzuke).not.toContain(r.id);
    const next = advanceBasho(joined);
    expect(next.lastReport!.shusse).toContain(r.id);
    expect(rk(next.banzuke, next.titles).get(r.id)?.division).toBe('jonokuchi');
  });

  it('教習所は入門から3場所。通う弟子は伸びが少しよい', async () => {
    const { inKyoshujo } = await import('../src');
    const career = (basho: number) => ({ career: { basho } }) as Parameters<typeof inKyoshujo>[0];
    expect(inKyoshujo(career(0))).toBe(true);
    expect(inKyoshujo(career(ROLES.kyoshujoBasho - 1))).toBe(true);
    expect(inKyoshujo(career(ROLES.kyoshujoBasho))).toBe(false);
    const { g, ranks } = withSekitori();
    const roles = stableRoles(g, ranks);
    const id = [...roles.of].find(([, x]) => x === 'chankoban')![0];
    expect(roleEffect(roles, id, career(0)).growth).toBeGreaterThan(
      roleEffect(roles, id, career(9)).growth,
    );
  });
});

describe('横綱審議委員会の稽古総見', () => {
  it('東京場所の前だけ、平幕中位以上の自分の弟子が出る。少し伸びて疲れ、記録に残る', async () => {
    const { advanceBasho, sokenAttendees, SOKEN, ranksOf: rk } = await import('../src');
    const g = play(6, 4);
    const ranks = rk(g.banzuke, g.titles);
    const r = g.rikishi.find((x) => x.stableId === g.player.stableId)!;
    r.injury = 0;
    r.policy = 'oshi';
    r.abilities.oshi = 40;
    r.talent = 90;
    // いちばん上の弟子を前頭3枚目の位置に置く（番付の並びを入れ替える）
    const m3 = g.banzuke.find((id) => {
      const k = ranks.get(id)!;
      return k.title === 'M' && k.number === 3;
    })!;
    const a = g.banzuke.indexOf(m3);
    const b = g.banzuke.indexOf(r.id);
    if (b >= 0) [g.banzuke[a], g.banzuke[b]] = [g.banzuke[b]!, g.banzuke[a]!];
    else g.banzuke[a] = r.id;
    for (const month of [0, 1, 2, 3, 4, 5]) {
      g.bashoIndex = 12 + month;
      const tokyo = (SOKEN.months as readonly number[]).includes(month);
      expect(sokenAttendees(g).includes(r.id)).toBe(tokyo);
    }
    g.bashoIndex = 12;
    const next = advanceBasho(g);
    expect(next.lastReport!.soken).toContain(r.id);
  });
});
