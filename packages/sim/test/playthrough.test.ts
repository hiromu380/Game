/**
 * 通しプレイの統合テスト: シード42で 3 シフトを最後まで遊べることを確認する
 *
 * バランス（ノルマ・予算・価格・ショップ重み）を変えるとこのテストが落ちることがある。
 * そのときは「まだクリア可能な難易度か」を確認し、手順を組み直すこと。
 */
import { describe, expect, it } from 'vitest';
import {
  buyOffer,
  commitShift,
  createRun,
  placePart,
  removePart,
  rotatePart,
  type Dir4,
  type PartId,
  type RunActionResult,
  type RunState,
} from '../src';

function unwrap(result: RunActionResult): RunState {
  if (!result.ok) throw new Error(`操作に失敗: ${result.error}`);
  return result.state;
}

/** ショップから指定パーツを（売れ残っている先頭から）買う */
function buy(run: RunState, partId: PartId): RunState {
  const index = run.shop.findIndex((o) => o.partId === partId && !o.sold);
  if (index < 0) throw new Error(`ショップに ${partId} がない`);
  return unwrap(buyOffer(run, index));
}

const place = (run: RunState, id: PartId, x: number, y: number, dir: Dir4 = 1) =>
  unwrap(placePart(run, id, x, y, dir));

function commit(run: RunState) {
  const result = commitShift(run);
  if ('error' in result) throw new Error(result.error);
  return result;
}

describe('通しプレイ（シード42）', () => {
  it('3シフトすべてノルマを達成してクリアできる', () => {
    let run = createRun(42);

    // --- シフト1: ギア3つの直列 → 1×2×2×2 = 8 ---
    run = buy(buy(buy(run, 'gear'), 'gear'), 'gear');
    run = place(run, 'switch', 0, 3);
    run = place(run, 'gear', 1, 3);
    run = place(run, 'gear', 2, 3);
    run = place(run, 'gear', 3, 3);
    run = place(run, 'dock', 4, 3);
    let shift = commit(run);
    expect(shift.outcome.cleared).toBe(true);
    expect(shift.result.score).toBe(8n);
    run = shift.state;

    // --- シフト2: プレス機を密集させて迂回路を作る ---
    // (2,3) のギアを下へ向け、プレス2台を経由して (3,3) のギアへ戻す
    run = buy(buy(buy(run, 'press'), 'press'), 'press');
    run = unwrap(rotatePart(run, 2, 3)); // 右 → 下
    run = place(run, 'press', 2, 4, 1); // 右へ
    run = place(run, 'press', 3, 4, 0); // 上へ
    run = place(run, 'press', 4, 4, 0); // 隣接数を増やすための置き石
    shift = commit(run);
    expect(shift.outcome.cleared).toBe(true);
    run = shift.state;

    // --- シフト3: 出荷口をプレスの隣に置いて倍率を上げ、末尾にギアを足す ---
    run = buy(buy(buy(buy(run, 'gear'), 'dock'), 'dock'), 'dock');
    run = unwrap(removePart(run, 4, 3)); // 末尾の出荷口を撤去（半額返金）
    run = place(run, 'gear', 4, 3, 1);
    run = place(run, 'dock', 5, 3);
    run = place(run, 'dock', 1, 4);
    run = place(run, 'dock', 3, 5);
    shift = commit(run);
    expect(shift.outcome.cleared).toBe(true);
    expect(shift.state.phase).toBe('cleared');
    expect(shift.state.history.map((h) => h.score)).toMatchInlineSnapshot(`
      [
        "8",
        "96",
        "320",
      ]
    `);
  });
});
