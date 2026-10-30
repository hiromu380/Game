import { describe, expect, it } from 'vitest';
import { wrestlerMotion } from '../src/art/three/animation';

const clock = { clash: 0.7, duration: 3.1 };
const stand = { x: 0.35, y: 0, rot: 0 };

describe('取組の3D関節モーション', () => {
  it('同じ入力なら必ず同じ結果になる', () => {
    const input = { ...clock, time: 1.1 };
    expect(wrestlerMotion(input, stand, 'E', 'push')).toEqual(
      wrestlerMotion(input, stand, 'E', 'push'),
    );
  });

  it('四股の脚上げは片側のみ。西と東で反対の脚を上げる', () => {
    const time = { ...clock, time: 0.19 };
    const east = wrestlerMotion(time, stand, 'E', 'side');
    const west = wrestlerMotion(time, stand, 'W', 'side');
    expect(Math.abs(east.legsZ[0])).toBeGreaterThan(0.05);
    expect(east.legsZ[1]).toBeCloseTo(0, 7);
    expect(Math.abs(west.legsZ[1])).toBeGreaterThan(0.05);
    expect(west.legsZ[0]).toBeCloseTo(0, 7);
  });

  it('立ち合い後だけ前へ手を出す', () => {
    expect(wrestlerMotion({ ...clock, time: 0 }, stand, 'E', 'side').armsX).toBe(0);
    expect(wrestlerMotion({ ...clock, time: 1 }, stand, 'E', 'push').armsX).toBeLessThan(-0.5);
  });

  it('投げ・押し倒しでは倒れる姿勢を優先し、脚のすり足を減衰させる', () => {
    const a = wrestlerMotion({ ...clock, time: 2.2 }, stand, 'W', 'side');
    const b = wrestlerMotion({ ...clock, time: 2.2 }, { ...stand, rot: 100 }, 'W', 'side');
    expect(Math.abs(b.legsX[0])).toBeLessThanOrEqual(Math.abs(a.legsX[0]));
    expect(b.rootRise).toBeGreaterThanOrEqual(a.rootRise);
  });

  it('結果時刻で揺れを停止し、reduced-motionの最終姿勢にも一致', () => {
    const a = wrestlerMotion({ ...clock, time: clock.duration }, stand, 'E', 'push');
    const b = wrestlerMotion({ ...clock, time: clock.duration + 10 }, stand, 'E', 'push');
    expect(a).toEqual(b);
    expect(a.armsX).toBe(0);
    expect(a.legsZ).toEqual([0, 0]);
    expect(a.legsX).toEqual([0, 0]);
  });

  it('入力不在時は静止し、すべての出力が有限', () => {
    const a = wrestlerMotion(undefined, stand, 'W', 'side');
    expect(a.legsZ).toEqual([0, 0]);
    for (const value of [a.armsX, ...a.legsX, ...a.legsZ, a.rootRise, a.leanZ, a.shadowScale]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});
