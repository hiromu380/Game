/**
 * 本番の確認画面の注意（置き忘れ・試運転の結果）
 */
import { createRun, type RunState } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { commitWarnings } from '../src/state/commitWarnings';
import type { TrialStatus } from '../src/state/trialStatus';

const withParts = (ids: ('switch' | 'dock')[]): RunState => {
  const run = createRun(1);
  const cells = run.board.cells.map(() => null) as RunState['board']['cells'];
  ids.forEach((id, i) => (cells[i] = { id, dir: 1 }));
  return { ...run, board: { ...run.board, cells } };
};
const fresh = (min: number, max: number, kind: 'fresh' | 'stale' = 'fresh'): TrialStatus => ({
  kind,
  last: BigInt(max),
  count: 2,
  min: BigInt(min),
  max: BigInt(max),
  random: min !== max,
});

describe('本番の確認画面の注意', () => {
  it('スイッチ・出荷口の置き忘れ（試運転の注意は重ねない）', () => {
    expect(commitWarnings(withParts([]), { kind: 'none' }, 3).map((w) => w.kind)).toEqual([
      'noSwitch',
      'noDock',
    ]);
    expect(commitWarnings(withParts(['switch']), { kind: 'none' }, 3)).toEqual([
      { kind: 'noDock' },
    ]);
  });

  it('試運転していない・古い・届かない・ランダムで届かない回がある・問題なし', () => {
    const run = withParts(['switch', 'dock']);
    expect(commitWarnings(run, { kind: 'none' }, 3)).toEqual([{ kind: 'noTrial' }]);
    expect(commitWarnings(run, fresh(5, 5, 'stale'), 3)).toEqual([{ kind: 'staleTrial' }]);
    expect(commitWarnings(run, fresh(1, 1), 3)).toEqual([{ kind: 'short', amount: 2n }]);
    expect(commitWarnings(run, fresh(1, 9), 3)).toEqual([{ kind: 'risky' }]);
    expect(commitWarnings(run, fresh(3, 9), 3)).toEqual([]);
  });
});
