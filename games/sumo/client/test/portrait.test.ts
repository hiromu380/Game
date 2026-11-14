import { describe, expect, it } from 'vitest';
import { oyakataLook, rikishiLook } from '../src/art/look';
import { PORTRAIT, portraitKey, portraitPixels } from '../src/art/pixel/portrait';

const base = {
  id: 12,
  weight: 140,
  stableId: 3,
  careerBasho: 20,
  sekitori: false,
  yokozuna: false,
  injured: false,
  fatigue: 0,
};
const same = (a: Uint8ClampedArray, b: Uint8ClampedArray) => Buffer.from(a).equals(Buffer.from(b));
const filled = (d: Uint8ClampedArray) => {
  let n = 0;
  for (let i = 3; i < d.length; i += 4) if (d[i]! > 0) n++;
  return n;
};

describe('顔の絵（ドット絵）', () => {
  it('胸像・全身とも枠の大きさで、絵が入っている。同じ見た目は同じ絵', () => {
    for (const variant of ['bust', 'full'] as const) {
      const look = rikishiLook(base);
      const p = portraitPixels(look, variant);
      expect(p.width).toBe(PORTRAIT[variant].width);
      expect(p.height).toBe(PORTRAIT[variant].height);
      expect(filled(p.data)).toBeGreaterThan(p.width * p.height * 0.3);
      expect(portraitPixels(rikishiLook(base), variant)).toBe(p);
      expect(portraitKey(rikishiLook(base), variant)).toBe(portraitKey(look, variant));
    }
    const look = rikishiLook(base);
    expect(portraitKey(look, 'full')).not.toBe(portraitKey(look, 'bust'));
  });

  it('絵は枠の端で切れない（上と左右に輪郭が収まる。胸像の下は枠で切る）', () => {
    for (let id = 1; id <= 40; id++) {
      for (const sekitori of [false, true]) {
        for (const variant of ['bust', 'full'] as const) {
          const p = portraitPixels(
            rikishiLook({ ...base, id, sekitori, weight: 90 + id * 3 }),
            variant,
          );
          const at = (x: number, y: number) => p.data[(y * p.width + x) * 4 + 3]! > 0;
          for (let x = 0; x < p.width; x++) expect(at(x, 0), `${variant} ${id} 上`).toBe(false);
          if (variant === 'full') {
            for (let y = 0; y < p.height; y++) {
              expect(at(0, y), `${id} 左`).toBe(false);
              expect(at(p.width - 1, y), `${id} 右`).toBe(false);
            }
          }
        }
      }
    }
  });

  it('状態で絵が変わる: けが・疲れ・関取（大銀杏）・横綱・新弟子（ざんばら）', () => {
    const plain = portraitPixels(rikishiLook(base), 'bust').data;
    for (const change of [
      { injured: true },
      { fatigue: 80 },
      { sekitori: true },
      { careerBasho: 1 },
    ]) {
      expect(same(portraitPixels(rikishiLook({ ...base, ...change }), 'bust').data, plain)).toBe(
        false,
      );
    }
    const ozeki = rikishiLook({ ...base, sekitori: true });
    const yokozuna = rikishiLook({ ...base, sekitori: true, yokozuna: true });
    for (const variant of ['bust', 'full'] as const)
      expect(
        same(portraitPixels(ozeki, variant).data, portraitPixels(yokozuna, variant).data),
      ).toBe(false);
  });

  it('顔つき（目・眉・口）の組み合わせで、別の顔になる', () => {
    const seen = new Set<string>();
    const faces = new Set<string>();
    for (let id = 1; id <= 60; id++) {
      const look = rikishiLook({ ...base, id });
      faces.add(`${look.eyes}/${look.brows}/${look.mouth}/${look.skin}`);
      seen.add(Buffer.from(portraitPixels(look, 'bust').data).toString('base64'));
    }
    expect(seen.size).toBe(faces.size);
  });

  it('親方は着物。年を取ると白髪', () => {
    const young = portraitPixels(oyakataLook({ id: 5, age: 45, stableId: 1 }), 'full');
    const old = portraitPixels(oyakataLook({ id: 5, age: 62, stableId: 1 }), 'full');
    expect(same(young.data, old.data)).toBe(false);
    expect(filled(young.data)).toBeGreaterThan(600);
  });
});
