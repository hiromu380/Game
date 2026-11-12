import { DEFAULT_RULES, type Board, type FloorLayer } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { bestPlacementCells } from '../src/board/hints';

const emptyFloor = (board: Board): FloorLayer => board.cells.map(() => null);

/** 3×3 の盤面（上段と左右にパーツ、真ん中と下段は空き） */
const board: Board = {
  width: 3,
  height: 3,
  cells: [
    { id: 'conveyor', dir: 1 },
    { id: 'conveyor', dir: 1 },
    { id: 'conveyor', dir: 1 },
    { id: 'conveyor', dir: 2 },
    null,
    { id: 'conveyor', dir: 2 },
    null,
    null,
    null,
  ],
};

describe('配置の手がかり', () => {
  it('プレス機は、隣のパーツがいちばん多い空きマスを示す', () => {
    const hints = bestPlacementCells(board, emptyFloor(board), DEFAULT_RULES, 'press');
    // 真ん中(4)は上・左・右の3つと隣り合う
    expect(hints?.cells).toEqual([4]);
    expect(hints?.badge.kind).toBe('mul');
  });

  it('使用不可のマスは候補にしない', () => {
    const floor = emptyFloor(board);
    floor[4] = { tile: 'blocked', source: 'stage' };
    const hints = bestPlacementCells(board, floor, DEFAULT_RULES, 'press');
    expect(hints?.cells).not.toContain(4);
  });

  it('置き場所で効果が変わらないパーツ・どこでも同じときは出さない', () => {
    expect(bestPlacementCells(board, emptyFloor(board), DEFAULT_RULES, 'conveyor')).toBeNull();
    expect(bestPlacementCells(board, emptyFloor(board), DEFAULT_RULES, 'gear')).toBeNull();
    const blank: Board = { width: 3, height: 3, cells: Array.from({ length: 9 }, () => null) };
    // 何もない盤面のコイルは、どこに置いても同じ
    expect(bestPlacementCells(blank, emptyFloor(blank), DEFAULT_RULES, 'coil')).toBeNull();
  });
});
