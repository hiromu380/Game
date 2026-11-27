/**
 * 試運転の状態（未試運転・試運転済み・配置を変えた後）とノルマのゲージ
 */
import { createRun, placePart, type RunState } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { quotaRatio, recordTrial, trialStatus } from '../src/state/trialStatus';

function place(run: RunState, partId: 'switch' | 'dock' | 'junkbot', x: number, y: number) {
  const r = placePart(run, partId, x, y, 1);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe('試運転の状態', () => {
  const run = place(createRun(1), 'switch', 0, 0);

  it('まだ試運転していなければ none', () => {
    expect(trialStatus(null, run)).toEqual({ kind: 'none' });
  });

  it('同じ盤面で試運転すると fresh。何度か試すと最小〜最大を持つ', () => {
    let record = recordTrial(null, run, 5n);
    record = recordTrial(record, run, 2n);
    expect(trialStatus(record, run)).toMatchObject({
      kind: 'fresh',
      last: 2n,
      count: 2,
      min: 2n,
      max: 5n,
      random: false,
    });
  });

  it('試運転の後に配置を変えると stale（表示中の結果は変更前の盤面のもの）。変えてから試すと記録をやり直す', () => {
    const record = recordTrial(null, run, 5n);
    const changed = place(run, 'dock', 1, 0);
    expect(trialStatus(record, changed).kind).toBe('stale');
    const again = recordTrial(record, changed, 7n);
    expect(trialStatus(again, changed)).toMatchObject({ kind: 'fresh', count: 1, last: 7n });
  });

  it('シフトが変わったら none に戻る', () => {
    const record = recordTrial(null, run, 5n);
    expect(trialStatus(record, { ...run, shiftIndex: 1 }).kind).toBe('none');
  });

  it('ランダムに動くパーツ（ポンコツロボ）があれば random', () => {
    const withJunk = { ...run, inventory: { ...run.inventory, junkbot: 1 } };
    const r = place(withJunk, 'junkbot', 2, 2);
    expect(trialStatus(recordTrial(null, r, 1n), r)).toMatchObject({ random: true });
  });
});

describe('ノルマのゲージ', () => {
  it('ノルマに対する割合（超えたら 1）。大きな数でも正しい', () => {
    expect(quotaRatio(0n, 10)).toBe(0);
    expect(quotaRatio(5n, 10)).toBe(0.5);
    expect(quotaRatio(15n, 10)).toBe(1);
    expect(quotaRatio(10n ** 30n, 10)).toBe(1);
    expect(quotaRatio(1n, 3)).toBeCloseTo(0.333, 3);
  });
});
