/**
 * 1シフトに何回も押す（試作）: 合計でノルマ・過熱・押さずに残った回数の報酬・工場の持ち越し
 */
import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  commitShift,
  createRun,
  DEFAULT_RULES,
  placePart,
  runTrial,
  scoreToString,
  simulate,
  type RunState,
  type ShiftSpec,
} from '../src';
import { board } from './helpers';
import { withBalance } from './testBalance';

/** ボスなしのシフト表（ボスの修正ルールで出荷量が変わらないように） */
const shifts = (quota: number, count = 3): ShiftSpec[] =>
  Array.from({ length: count }, () => ({ quota, budget: 10, clearReward: 2, kind: 'normal' }));

const presses = { ...BALANCE.presses, perShift: 3, spareReward: 2 };

/** スイッチ → ギア → 出荷口（1回押すと 2 を出荷） */
function gearLine(quota: number): RunState {
  let run = createRun(1, {
    balance: withBalance({ shifts: shifts(quota), presses, resetBoardEachDay: false }),
  });
  run = { ...run, inventory: { switch: 1, gear: 1, dock: 1 }, bonusFloor: null, budget: 0 };
  for (const [id, x] of [
    ['switch', 0],
    ['gear', 1],
    ['dock', 2],
  ] as const) {
    const r = placePart(run, id, x, 0, 1);
    if (!r.ok) throw new Error(r.error);
    run = r.state;
  }
  return run;
}

function commit(run: RunState) {
  const r = commitShift(run);
  if ('error' in r) throw new Error(r.error);
  return r;
}

describe('1シフトに3回押す', () => {
  it('ノルマに届くまで同じシフトで押せる。合計で判定し、押さずに残った回数は報酬になる', () => {
    const run = gearLine(3);
    const first = commit(run);
    expect(first.outcome.continues).toBe(true);
    expect(first.state.shiftIndex).toBe(0);
    expect(first.state.press?.count).toBe(1);
    expect(first.state.press?.shipped).toBe('2');
    // 2回目: ギアのマスは過熱して素通り → 1 を出荷して合計 3 でノルマ達成、残り1回分の報酬
    const second = commit(first.state);
    expect(second.result.events.some((e) => e.type === 'overheat')).toBe(true);
    expect(scoreToString(second.result.score)).toBe('1');
    expect(second.outcome.cleared).toBe(true);
    expect(second.outcome.spareReward).toBe(presses.spareReward);
    expect(second.state.shiftIndex).toBe(1);
    expect(second.state.press).toBeNull();
    expect(second.state.budget).toBe(first.state.budget + 2 + 10 + presses.spareReward);
    expect(second.state.history[0]?.score).toBe('3');
  });

  it('過熱は次の回だけ（3回目には冷めている）。出荷口・スイッチは過熱しない', () => {
    const run = gearLine(100);
    const a = commit(run);
    expect(a.state.press?.hot).toEqual([1]);
    const b = commit(a.state);
    expect(b.state.press?.hot).toEqual([]);
    const c = commit(b.state);
    expect(scoreToString(c.result.score)).toBe('2');
    expect(c.outcome.cleared).toBe(false);
    expect(c.state.phase).toBe('failed');
    expect(c.state.history[0]?.score).toBe('5');
  });

  it('試運転にも過熱が効く', () => {
    const a = commit(gearLine(100));
    expect(scoreToString(runTrial(a.state).result.score)).toBe('1');
  });

  it('1シフト1回のラン（既定）は従来どおり', () => {
    let run = createRun(1, { balance: withBalance({ shifts: shifts(100) }) });
    run = { ...run, inventory: { switch: 1, dock: 1 }, bonusFloor: null };
    run = (placePart(run, 'switch', 0, 0, 1) as { state: RunState }).state;
    run = (placePart(run, 'dock', 1, 0, 1) as { state: RunState }).state;
    expect(commit(run).state.phase).toBe('failed');
  });

  it('工場の持ち越し: 日が変わっても盤面を片付けない（使用不可になったマスのパーツだけ手持ちへ）', () => {
    let run = createRun(1, {
      balance: withBalance({ shifts: shifts(1, 6), presses, resetBoardEachDay: false }),
    });
    run = { ...run, inventory: { switch: 1, dock: 1 }, bonusFloor: null };
    run = (placePart(run, 'switch', 0, 0, 1) as { state: RunState }).state;
    run = (placePart(run, 'dock', 1, 0, 1) as { state: RunState }).state;
    for (let i = 0; i < 3; i++) run = commit(run).state;
    expect(run.shiftIndex).toBe(3);
    const onBoard = run.board.cells.filter((c) => c !== null).length;
    const inHand = (run.inventory.switch ?? 0) + (run.inventory.dock ?? 0);
    expect(onBoard + inHand).toBe(2);
    expect(onBoard).toBeGreaterThan(0);
  });
});

describe('過熱したマス（simulate）', () => {
  it('発動せず、同じ信号が向きも値も変えずに通り抜ける', () => {
    const r = simulate({ board: board(['S> G> G> D>']), seed: 1, rules: DEFAULT_RULES, hot: [1] });
    expect(scoreToString(r.score)).toBe('2');
    expect(r.events.filter((e) => e.type === 'overheat')).toHaveLength(1);
    expect(r.stats.chainCount).toBe(2);
  });
});
