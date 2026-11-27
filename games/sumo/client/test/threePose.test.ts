import { describe, expect, it } from 'vitest';
import { TAWARA_RADIUS, toStagePose } from '../src/art/three/pose';

describe('取組台本から3D座標への変換', () => {
  it('東西の符号と俵までの距離を保つ', () => {
    expect(toStagePose({ x: 1, y: 0, rot: 0 }).x).toBe(TAWARA_RADIUS);
    expect(toStagePose({ x: -1, y: 0, rot: 0 }).x).toBe(-TAWARA_RADIUS);
  });

  it('土俵外の位置を切り詰めず倒れた力士を退場方向へ動かす', () => {
    expect(toStagePose({ x: 1.25, y: 0, rot: 80 }).x).toBeGreaterThan(TAWARA_RADIUS);
  });

  it('倒れ方の角度をラジアンにし、奥行きだけを制限する', () => {
    const pose = toStagePose({ x: 0, y: 3, rot: 90 });
    expect(pose.tilt).toBeCloseTo(-Math.PI / 2);
    expect(pose.depth).toBe(0.6);
    expect(toStagePose({ x: 0, y: -3, rot: -90 }).depth).toBe(-0.6);
  });

  it('同じ入力は常に同じ表示座標になる', () => {
    const input = { x: -0.33, y: 0.18, rot: -70 };
    expect(toStagePose(input)).toEqual(toStagePose(input));
  });
});
