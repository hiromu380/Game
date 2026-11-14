import { describe, expect, it } from 'vitest';
import { KIMARITE, type Rikishi } from '../src';
import { createPrng } from '../src/core/prng';
import { kimariteFor } from '../src/basho/strength';
import { createGame } from '../src';

describe('決まり手', () => {
  const s = createGame({ seed: 1 });
  const pickStyle = (style: 'oshi' | 'yotsu' | 'waza'): Rikishi =>
    s.rikishi.find((r) => {
      const a = r.abilities;
      const top = Math.max(a.oshi, a.yotsu, a.waza);
      return a[style] === top && a.oshi + a.yotsu + a.waza > 0;
    })!;

  it('82手と非技5つ。名前はすべて違う', () => {
    expect(KIMARITE).toHaveLength(87);
    expect(new Set(KIMARITE.map((k) => k.id)).size).toBe(87);
    expect(KIMARITE.filter((k) => k.group === 'hiwaza')).toHaveLength(5);
  });

  it('寄り切り・押し出し・寄り倒し・押し倒し・叩き込み・突き落としが多く、珍しい技はまれ', () => {
    const rng = createPrng(7);
    const count = new Map<string, number>();
    const n = 20_000;
    const styles = ['oshi', 'yotsu', 'waza'] as const;
    for (let i = 0; i < n; i++) {
      const w = pickStyle(styles[i % 3]!);
      const l = pickStyle(styles[(i + 1) % 3]!);
      const k = kimariteFor(w, l, i % 5 === 0 ? 0.3 : 0.6, rng);
      count.set(k, (count.get(k) ?? 0) + 1);
    }
    const share = (ids: string[]) => ids.reduce((a, id) => a + (count.get(id) ?? 0), 0) / n;
    expect(share(['yorikiri', 'oshidashi', 'yoritaoshi', 'oshitaoshi'])).toBeGreaterThan(0.45);
    expect(share(['yorikiri', 'oshidashi', 'yoritaoshi', 'oshitaoshi'])).toBeLessThan(0.7);
    expect(share(['hatakikomi', 'tsukiotoshi'])).toBeGreaterThan(0.05);
    expect(
      share(['izori', 'shumokuzori', 'kakezori', 'tasukizori', 'sototasukizori']),
    ).toBeLessThan(0.002);
  });

  it('同じ乱数なら同じ決まり手（乱数は1回だけ使う）', () => {
    const w = pickStyle('yotsu');
    const l = pickStyle('oshi');
    const a = createPrng(3);
    const b = createPrng(3);
    expect(kimariteFor(w, l, 0.5, a)).toBe(kimariteFor(w, l, 0.5, b));
    // 乱数を1回だけ使う: 使った後の a は、1回進めた c と同じ
    const c = createPrng(3);
    c.nextUint32();
    expect(a.nextUint32()).toBe(c.nextUint32());
  });
});
