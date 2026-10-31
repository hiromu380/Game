import { describe, expect, it } from 'vitest';
import { TAWARA_RADIUS } from '../src/art/three/pose';
import { dohyoBales } from '../src/art/three/dohyoDetails';

describe('3D土俵の勝負俵', () => {
  it('同じ設定なら常に同じ位置になる', () => {
    expect(dohyoBales()).toEqual(dohyoBales());
    expect(dohyoBales()).toHaveLength(28);
  });

  it('すべての俵が円周上にあり、長軸は円周の接線方向を向く', () => {
    for (const b of dohyoBales()) {
      expect(Math.hypot(b.x, b.z)).toBeCloseTo(TAWARA_RADIUS, 10);
      expect(b.x * b.dx + b.z * b.dz).toBeCloseTo(0, 10);
      expect(Math.hypot(b.dx, b.dz)).toBeCloseTo(1, 10);
    }
  });

  it('不正な俵数を受け付けない', () => {
    expect(() => dohyoBales(2)).toThrow(RangeError);
    expect(() => dohyoBales(1.2)).toThrow(RangeError);
    expect(() => dohyoBales(121)).toThrow(RangeError);
  });
});
