import { createWeeklyRun, createRun, type RunState } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { ROCKET_CONFIG } from '../src/config/rocket';
import { getDestination, getRocketProgress, ROCKET_PARTS } from '../src/state/rocket';

/** cleared 個のシフトをクリアした履歴を持つラン */
function withCleared(run: RunState, cleared: number, overtime = false): RunState {
  const history = Array.from({ length: cleared }, (_, i) => ({
    shiftIndex: i,
    score: '1',
    quota: 1,
    cleared: true,
    chainCount: 1,
    income: 0,
    boss: null,
  }));
  return { ...run, history, overtime };
}

describe('ロケットの進み具合', () => {
  it('部品の数は絵の段階と合う（通常ランは1シフト1部品）', () => {
    expect(ROCKET_PARTS).toBe(createRun(1).config.shifts.length);
  });

  it('通常ラン: クリアしたシフトの数だけ部品が組み上がり、全部で発射', () => {
    const run = createRun(1);
    expect(getRocketProgress(run)).toEqual({ parts: 0, launched: false, destinations: 0 });
    expect(getRocketProgress(withCleared(run, 4))).toMatchObject({ parts: 4, launched: false });
    expect(getRocketProgress(withCleared(run, 9))).toMatchObject({ parts: 9, launched: true });
  });

  it('ノルマ未達のシフトは数えない', () => {
    const run = withCleared(createRun(1), 3);
    const failed = {
      ...run,
      history: [...run.history, { ...run.history[0]!, shiftIndex: 3, cleared: false }],
    };
    expect(getRocketProgress(failed).parts).toBe(3);
  });

  it('デイリー（3シフト）は1シフトで3部品ずつ', () => {
    const run = createWeeklyRun('2026-10-01');
    expect(getRocketProgress(withCleared(run, 1)).parts).toBe(3);
    expect(getRocketProgress(withCleared(run, 3))).toMatchObject({ parts: 9, launched: true });
  });

  it('延長戦は1日クリアするごとに行き先が1つ進む', () => {
    const run = createRun(1);
    const perDay = run.config.shiftsPerDay;
    expect(getRocketProgress(withCleared(run, 9 + perDay - 1, true)).destinations).toBe(0);
    expect(getRocketProgress(withCleared(run, 9 + perDay, true))).toMatchObject({
      parts: 9,
      launched: true,
      destinations: 1,
    });
  });
});

describe('延長戦の行き先', () => {
  it('1日目で最初の行き先、一覧の最後より先は余りの日数を数える', () => {
    expect(getDestination(0)).toBeNull();
    expect(getDestination(1)).toEqual({ key: ROCKET_CONFIG.destinations[0], extraDays: 0 });
    const last = ROCKET_CONFIG.destinations.length;
    expect(getDestination(last)).toEqual({
      key: ROCKET_CONFIG.destinations[last - 1],
      extraDays: 0,
    });
    expect(getDestination(last + 2)).toEqual({
      key: ROCKET_CONFIG.destinations[last - 1],
      extraDays: 2,
    });
  });
});
