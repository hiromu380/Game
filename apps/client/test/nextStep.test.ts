import { createRun, type RunState } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { nextStep } from '../src/state/nextStep';
import type { TrialStatus } from '../src/state/trialStatus';

const NONE: TrialStatus = { kind: 'none' };
const fresh = (min: bigint, max: bigint, kind: 'fresh' | 'stale' = 'fresh'): TrialStatus => ({
  kind,
  last: max,
  count: 2,
  min,
  max,
  random: min !== max,
});

/** スイッチと出荷口を置いた盤面 */
function built(): RunState {
  const run = createRun(1);
  const cells = [...run.board.cells];
  cells[0] = { id: 'switch', dir: 1 };
  cells[1] = { id: 'dock', dir: 1 };
  const inventory = { ...run.inventory, switch: 0, dock: 0 };
  return { ...run, board: { ...run.board, cells }, inventory };
}

describe('次にすること', () => {
  it('スイッチ → 出荷口 → 試運転の順に案内する', () => {
    const run = createRun(1);
    expect(nextStep(run, null, NONE, 3)).toEqual({ kind: 'placeSwitch' });
    const cells = [...run.board.cells];
    cells[0] = { id: 'switch', dir: 1 };
    const withSwitch = { ...run, board: { ...run.board, cells } };
    expect(nextStep(withSwitch, null, NONE, 3)).toEqual({ kind: 'placeDock' });
    expect(nextStep(built(), null, NONE, 3)).toEqual({ kind: 'trial' });
  });

  it('選択中は選択に合った操作を案内する', () => {
    const run = createRun(1);
    expect(nextStep(run, { kind: 'inventory', partId: 'gear', dir: 1 }, NONE, 3)).toEqual({
      kind: 'placing',
    });
    expect(nextStep(run, { kind: 'cell', x: 0, y: 0 }, NONE, 3)).toEqual({
      kind: 'cellSelected',
    });
  });

  it('試運転の結果で、不足・運しだい・準備OK を分ける', () => {
    const run = built();
    expect(nextStep(run, null, fresh(1n, 1n), 3)).toEqual({ kind: 'short', amount: 2n });
    expect(nextStep(run, null, fresh(1n, 5n), 3)).toEqual({ kind: 'risky' });
    expect(nextStep(run, null, fresh(3n, 3n), 3)).toEqual({ kind: 'ready' });
    expect(nextStep(run, null, fresh(3n, 3n, 'stale'), 3)).toEqual({
      kind: 'trial',
    });
  });

  it('組み立て中でなければ出さない', () => {
    expect(nextStep({ ...built(), phase: 'failed' }, null, NONE, 3)).toBeNull();
  });
});
