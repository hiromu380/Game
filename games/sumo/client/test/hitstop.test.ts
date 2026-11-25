import { describe, expect, it } from 'vitest';
import { HIT_STOP, hitStopTime, stopJitter } from '../src/playback/boutStage';

describe('ヒットストップ', () => {
  const clash = 0.6;
  const finish = 2;
  it('当たった瞬間と決まった瞬間に取組の時間を止め、その後は止めた分だけ遅れて進む', () => {
    expect(hitStopTime(0.3, clash, finish)).toEqual({ time: 0.3, stop: null });
    const a = hitStopTime(clash + 0.05, clash, finish);
    expect(a.time).toBe(clash);
    expect(a.stop?.kind).toBe('clash');
    expect(hitStopTime(1.5, clash, finish).time).toBeCloseTo(1.5 - HIT_STOP.clash);
    const b = hitStopTime(finish + HIT_STOP.clash + 0.1, clash, finish);
    expect(b.time).toBe(finish);
    expect(b.stop?.kind).toBe('finish');
    const end = 3;
    expect(hitStopTime(end + HIT_STOP.clash + HIT_STOP.finish, clash, finish).time).toBeCloseTo(
      end,
    );
  });

  it('取組の時間は戻らない', () => {
    let last = -1;
    for (let r = 0; r < 4; r += 0.01) {
      const { time } = hitStopTime(r, clash, finish);
      expect(time).toBeGreaterThanOrEqual(last);
      last = time;
    }
  });

  it('震えは負けた側が大きく、だんだん小さくなる', () => {
    const early = { kind: 'finish' as const, elapsed: 0 };
    const late = { kind: 'finish' as const, elapsed: HIT_STOP.finish * 0.95 };
    expect(Math.abs(stopJitter(early, true))).toBeGreaterThan(Math.abs(stopJitter(early, false)));
    expect(Math.abs(stopJitter(late, true))).toBeLessThan(Math.abs(stopJitter(early, true)));
  });
});
