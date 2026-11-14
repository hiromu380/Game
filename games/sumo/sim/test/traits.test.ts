import { describe, expect, it } from 'vitest';
import {
  advanceBasho,
  createGame,
  TRAIT_EXCLUSIVE,
  tokuiWaza,
  traitsOf,
  type Rikishi,
  type TraitId,
} from '../src';
import { train, NEUTRAL_GROWTH } from '../src/career/growth';
import { kimariteFor } from '../src/basho/strength';
import { createPrng } from '../src/core/prng';

const base = createGame({ seed: 1 }).rikishi[0]!;

/** 指定した個性だけを持つ（または何も持たない）ID を探す */
function withTraits(want: TraitId[], from: Rikishi = base): Rikishi {
  for (let id = 1; id < 100_000; id++) {
    const t = traitsOf({ ...from, id });
    if (t.length === want.length && want.every((w) => t.includes(w)))
      return JSON.parse(JSON.stringify({ ...from, id }));
  }
  throw new Error('見つからない');
}

describe('力士の個性', () => {
  it('同じ力士なら同じ個性。0〜2個で、両立しない組は持たない。だいたい15%は個性なし', () => {
    const s = createGame({ seed: 2 });
    let none = 0;
    for (const r of s.rikishi) {
      const t = traitsOf(r);
      expect(traitsOf({ id: r.id, talent: r.talent, height: r.height })).toEqual(t);
      expect(t.length).toBeLessThanOrEqual(2);
      for (const [a, b] of TRAIT_EXCLUSIVE) expect(t.includes(a) && t.includes(b)).toBe(false);
      if (t.length === 0) none++;
    }
    expect(none / s.rikishi.length).toBeGreaterThan(0.08);
    expect(none / s.rikishi.length).toBeLessThan(0.25);
  });

  it('稽古熱心は稽古嫌いよりよく伸びる（同じ乱数で比べる）', () => {
    const young = {
      ...base,
      age: 17,
      talent: 90,
      abilities: { oshi: 20, yotsu: 20, waza: 20 },
      injury: 0,
      fatigue: 0,
      policy: 'oshi' as const,
      boost: 1,
    };
    const d = withTraits(['diligent'], young);
    const l = withTraits(['lazy'], young);
    train(d, NEUTRAL_GROWTH, createPrng(9));
    train(l, NEUTRAL_GROWTH, createPrng(9));
    expect(d.abilities.oshi).toBeGreaterThan(l.abilities.oshi);
    expect(d.fatigue).toBeGreaterThan(l.fatigue);
  });

  it('得意技: 5勝以上で白星の2割以上の決まり手。非技は数えない', () => {
    expect(tokuiWaza({})).toBeNull();
    expect(tokuiWaza({ kimarite: { yorikiri: 4 } })).toBeNull();
    expect(tokuiWaza({ kimarite: { yorikiri: 6, oshidashi: 20 } })).toBe('oshidashi');
    expect(tokuiWaza({ kimarite: { isamiashi: 30, uwatenage: 5 } })).toBe('uwatenage');
  });

  it('得意技があると、その決まり手が出やすい', () => {
    const w = JSON.parse(JSON.stringify(base)) as Rikishi;
    const count = (r: Rikishi) => {
      const rng = createPrng(5);
      let n = 0;
      for (let i = 0; i < 3000; i++) if (kimariteFor(r, base, 0.6, rng) === 'uwatenage') n++;
      return n;
    };
    const before = count(w);
    w.career.kimarite = { uwatenage: 10 };
    expect(count(w)).toBeGreaterThan(before * 1.8);
  });

  it('場所が終わると、勝った決まり手が経歴に数えられる', () => {
    const s = advanceBasho(createGame({ seed: 3 }));
    const total = s.rikishi.reduce(
      (n, r) => n + Object.values(r.career.kimarite ?? {}).reduce((a, b) => a + b, 0),
      0,
    );
    expect(total).toBeGreaterThan(1000);
  });
});
