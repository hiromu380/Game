/**
 * ボットの動作確認（バランスの良し悪しではなく「正しく遊べるか」を見る）
 */
import { describe, expect, it } from 'vitest';
import { playRun } from '../src/runner';

const OPTIONS = { samples: 2, timeLimitMs: 500, maxRerolls: 2 };

describe('ボット', () => {
  it('ランダムボットは1ランを最後まで（脱落まで）遊べる', () => {
    const log = playRun(1, 'random', OPTIONS);
    expect(log.shifts.length).toBeGreaterThan(0);
    expect(log.shifts.length).toBeLessThanOrEqual(9);
  });

  it('貪欲ボットは最初のシフトをクリアでき、同じシードなら同じ結果になる', () => {
    const a = playRun(42, 'greedy', OPTIONS);
    const b = playRun(42, 'greedy', OPTIONS);
    expect(a.shifts[0]?.cleared).toBe(true);
    expect(b.shifts).toEqual(a.shifts);
  });

  it('探索ボットは貪欲ボット以上のシフトを進める（同じシード）', () => {
    const greedy = playRun(7, 'greedy', OPTIONS);
    const search = playRun(7, 'search', { ...OPTIONS, timeLimitMs: 2000 });
    expect(search.shiftsCleared).toBeGreaterThanOrEqual(greedy.shiftsCleared);
  });
});
