/**
 * 延長戦（全シフトクリア後のエンドレス）のテスト
 */
import { describe, expect, it } from 'vitest';
import {
  applyRunToMeta,
  BALANCE,
  commitShift,
  createInitialMeta,
  createRun,
  placePart,
  startOvertime,
  type RunState,
} from '../src';
import { easyShifts, withBalance } from './testBalance';

function unwrapPlace(run: RunState): RunState {
  const s = placePart(run, 'switch', 0, 0, 1);
  if (!s.ok) throw new Error(s.error);
  const d = placePart(s.state, 'dock', 1, 0, 1);
  if (!d.ok) throw new Error(d.error);
  return d.state;
}

function commit(run: RunState): RunState {
  const r = commitShift(run);
  if ('error' in r) throw new Error(r.error);
  return r.state;
}

/** ノルマ1・3シフトの本編をクリアしたラン（ボスなし） */
function clearedRun(): RunState {
  const balance = withBalance({ shifts: easyShifts(3, 99), overtime: { ...BALANCE.overtime } });
  let run = unwrapPlace(createRun(1, { balance }));
  for (let i = 0; i < 3; i++) run = commit(run);
  return run;
}

describe('延長戦', () => {
  it('全シフトクリア後にだけ入れて、1日分（朝・昼・夜）のシフトが追加される', () => {
    expect(startOvertime(createRun(1))).toBeNull();
    const cleared = clearedRun();
    expect(cleared.phase).toBe('cleared');

    const overtime = startOvertime(cleared)!;
    expect(overtime.phase).toBe('building');
    expect(overtime.overtime).toBe(true);
    expect(overtime.shiftIndex).toBe(3);
    expect(overtime.config.shifts).toHaveLength(6);
    // 夜のボスは朝のうちから決まっている（予告できる）
    expect(overtime.config.bossPlan[5]).not.toBeNull();
    // 繰り越し予算 + 延長戦の予算
    expect(overtime.budget).toBe(cleared.budget + BALANCE.overtime.budget);
    expect(startOvertime(overtime)).toBeNull();
  });

  it(`ノルマは毎シフト ${BALANCE.overtime.quotaGrowthPercent}% ずつ上がり、1日の最後のシフトはボス`, () => {
    let run = startOvertime(clearedRun())!;
    const q0 = run.config.shifts[3]!.quota;
    expect(q0).toBe(Math.floor((1 * BALANCE.overtime.quotaGrowthPercent) / 100));
    // ノルマが小さいうちは最小構成でもクリアできる。何シフトか進める
    while (run.phase === 'building' && run.shiftIndex < 6) run = commit(run);
    const specs = run.config.shifts;
    for (let i = 4; i < specs.length; i++) {
      expect(specs[i]!.quota).toBe(
        Math.floor((specs[i - 1]!.quota * BALANCE.overtime.quotaGrowthPercent) / 100),
      );
      expect(specs[i]!.kind).toBe((i + 1) % 3 === 0 ? 'boss' : 'normal');
      expect(run.config.bossPlan[i] !== null).toBe(specs[i]!.kind === 'boss');
    }
  });

  it('同じシードなら延長戦のシフトも同じになる（決定論）', () => {
    const a = startOvertime(clearedRun())!;
    const b = startOvertime(clearedRun())!;
    expect(a).toEqual(b);
  });

  it('延長戦で脱落しても、本編クリアの実績は1回だけ数える', () => {
    let meta = createInitialMeta();
    const cleared = clearedRun();
    const first = applyRunToMeta(meta, cleared);
    meta = first.meta;
    expect(meta.records.clears).toBe(1);
    expect(meta.records.runsPlayed).toBe(1);

    // 延長戦に入り、スコア1ではいずれ脱落する
    let run = startOvertime(first.run)!;
    while (run.phase === 'building') run = commit(run);
    expect(run.phase).toBe('failed');
    const second = applyRunToMeta(meta, run);
    expect(second.meta.records.clears).toBe(1);
    expect(second.meta.records.runsPlayed).toBe(1);
    expect(second.meta.records.bestShiftReached).toBe(run.history.length - 1);
  });
});
