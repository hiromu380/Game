/**
 * ボットの動作確認（バランスの良し悪しではなく「正しく遊べるか」を見る）
 */
import { describe, expect, it } from 'vitest';
import { playRun } from '../src/runner';

const OPTIONS = {
  unlock: 'all' as const,
  samples: 2,
  evalMode: 'mean' as const,
  timeLimitMs: 500,
  maxRerolls: 2,
};

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

  it('中級ボットは組み替え（回転・移動）を使い、貪欲ボット以上のシフトを進める（同じシード）', () => {
    const greedy = playRun(7, 'greedy', OPTIONS);
    const mid = playRun(7, 'mid', OPTIONS);
    expect(mid.shiftsCleared).toBeGreaterThanOrEqual(greedy.shiftsCleared);
    expect(playRun(7, 'mid', OPTIONS).shifts).toEqual(mid.shifts); // 決定論
  });

  it('探索ボットは貪欲ボット以上のシフトを進める（同じシード）', () => {
    // 探索ボットは思考時間で打ち切るため、CPU が混んでいると結果が変わる。差がはっきり出るシードで確かめる
    const greedy = playRun(2, 'greedy', OPTIONS);
    const search = playRun(2, 'search', { ...OPTIONS, timeLimitMs: 2000 });
    expect(search.shiftsCleared).toBeGreaterThanOrEqual(greedy.shiftsCleared);
  });

  it('現在のバランスで、貪欲ボットがシード24の9シフトを最後までクリアできる（通しプレイの回帰確認）', () => {
    // バランス調整でこのテストが落ちたら、クリアできるシードを選び直すか、難しくなりすぎていないか確認する
    // フェーズ3c（SIM_VERSION 2）でシード1 → 3 に変更（ポンコツロボ・回転台の調整で購入の判断や連鎖の結果が変わったため）
    // SIM_VERSION 3（日ごとの片付け）でシード3 → 6 に変更（難易度の調整は後で行う）
    // SIM_VERSION 5（床タイル・日ごとのステージ・ボーナス床）でシード6 → 24 に変更（床で購入や配置の判断が変わり、
    // ボットが床を見てスイッチを置くようにしたため）
    const log = playRun(24, 'greedy', {
      unlock: 'all',
      samples: 3,
      evalMode: 'mean',
      timeLimitMs: 3000,
      maxRerolls: 3,
    });
    expect(log.shifts).toHaveLength(9);
    expect(log.cleared).toBe(true);
  });
});
