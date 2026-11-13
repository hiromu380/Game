import { describe, expect, it } from 'vitest';
import { points, signedPoints } from '../src/points';

describe('能力の目盛り（画面は10倍の整数）', () => {
  it('能力 78.4 は 784、伸び 0.3 は +3。動いていなければ ±0、減れば −', () => {
    expect(points(78.4)).toBe(784);
    expect(points(100)).toBe(1000);
    expect(signedPoints(0.3)).toBe('+3');
    expect(signedPoints(0.04)).toBe('±0');
    expect(signedPoints(-1.2)).toBe('−12');
  });
});
