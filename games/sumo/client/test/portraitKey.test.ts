import { describe, expect, it } from 'vitest';
import { rikishiLook } from '../src/art/look';
import { portraitKey } from '../src/art/portraitKey';

const rikishi = {
  id: 19,
  weight: 135,
  stableId: 3,
  careerBasho: 9,
  sekitori: false,
  yokozuna: false,
  injured: false,
  fatigue: 0,
};

describe('3D肖像のキャッシュキー', () => {
  it('同じ見た目と画角は同じ画像を使う', () => {
    expect(portraitKey(rikishiLook(rikishi), 'bust')).toBe(
      portraitKey(rikishiLook(rikishi), 'bust'),
    );
  });
  it('けが・疲労・地位が変わると画像を作り直す', () => {
    const base = portraitKey(rikishiLook(rikishi), 'bust');
    expect(portraitKey(rikishiLook({ ...rikishi, injured: true }), 'bust')).not.toBe(base);
    expect(portraitKey(rikishiLook({ ...rikishi, fatigue: 80 }), 'bust')).not.toBe(base);
    expect(portraitKey(rikishiLook({ ...rikishi, sekitori: true }), 'bust')).not.toBe(base);
  });
  it('全身と上半身では異なる画像を使用する', () => {
    const look = rikishiLook(rikishi);
    expect(portraitKey(look, 'full')).not.toBe(portraitKey(look, 'bust'));
  });
});
