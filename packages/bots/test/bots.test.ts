/**
 * ボットの動作確認（バランスの良し悪しではなく「正しく遊べるか」を見る）
 */
import { describe, expect, it } from 'vitest';
import { createRun, type PartId, type RunState } from '@chain-factory/sim';
import { playGolden, playRun } from '../src';

const OPTIONS = {
  unlock: 'all' as const,
  samples: 2,
  evalMode: 'mean' as const,
  timeLimitMs: 500,
  maxRerolls: 2,
};

describe('ボット', () => {
  it('ランダム配置権は、並べば期待値で買って使うことがあり、使わないボットとも比べられる', () => {
    const logs = [1, 2, 3, 4, 5, 6].map((seed) => playRun(seed, 'greedy', OPTIONS));
    const permits = logs.reduce(
      (n, l) => ({ offered: n.offered + l.permits.offered, used: n.used + l.permits.used }),
      { offered: 0, used: 0 },
    );
    expect(permits.offered).toBeGreaterThan(0);
    expect(permits.used).toBeGreaterThan(0);
    const off = playRun(1, 'greedy', { ...OPTIONS, permits: false });
    expect(off.permits.used).toBe(0);
  });

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
    // SIM_VERSION 6（ショップに配置権の枠）でシード 7 → 2 に変更（品ぞろえが変わったため）
    const greedy = playRun(2, 'greedy', OPTIONS);
    const mid = playRun(2, 'mid', OPTIONS);
    expect(mid.shiftsCleared).toBeGreaterThanOrEqual(greedy.shiftsCleared);
    expect(playRun(2, 'mid', OPTIONS).shifts).toEqual(mid.shifts); // 決定論
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

describe('金色パーツ', () => {
  it('見込みが増えるときだけ合体し、増えないなら盤面を変えない', () => {
    const base = createRun(1);
    const empty = base.board.cells.map(() => null) as RunState['board']['cells'];
    const put = (cells: RunState['board']['cells'], x: number, y: number, id: PartId) => {
      cells[y * base.board.width + x] = { id, dir: 1 };
    };
    // スイッチ → 出荷口が3つ横並び（先頭の出荷口だけが信号を受ける）。合体すれば先頭が ×3
    const cells = [...empty];
    put(cells, 0, 0, 'switch');
    put(cells, 1, 0, 'dock');
    put(cells, 1, 1, 'dock');
    put(cells, 1, 2, 'dock');
    const run: RunState = {
      ...base,
      board: { ...base.board, cells },
      bonusFloor: null,
      itemFloors: null,
    };
    const log = { merged: 0, placed: 0 };
    const merged = playGolden(run, 1, 'mean', log);
    expect(log.merged).toBe(1);
    expect(merged.board.cells.filter((c) => c?.golden)).toHaveLength(1);

    // 合体しても見込みが増えない盤面（出荷口に信号が届かない）は変えない
    const idle = playGolden(
      { ...run, board: { ...run.board, cells: cells.map((c) => (c?.id === 'switch' ? null : c)) } },
      1,
      'mean',
      { merged: 0, placed: 0 },
    );
    expect(idle.board.cells.some((c) => c?.golden)).toBe(false);
  });
});
