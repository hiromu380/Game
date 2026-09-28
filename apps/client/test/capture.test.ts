/**
 * 撮影モード: 盤面の JSON の読み込み
 */
import { createRun } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { parseBoard } from '../src/ui/CapturePanel';

describe('撮影モードの盤面の読み込み', () => {
  it('書き出した盤面はそのまま読める', () => {
    const board = createRun(1).board;
    const withPart = {
      ...board,
      cells: board.cells.map((c, i) => (i === 3 ? { id: 'gear', dir: 1 } : c)),
    };
    expect(parseBoard(JSON.stringify(withPart), board.width, board.height)).toEqual(withPart);
  });

  it('大きさが違う・知らないパーツ・壊れた JSON は読まない', () => {
    const board = createRun(1).board;
    expect(parseBoard(JSON.stringify(board), board.width + 1, board.height)).toBeNull();
    const bad = {
      ...board,
      cells: board.cells.map((c, i) => (i === 0 ? { id: 'laser', dir: 0 } : c)),
    };
    expect(parseBoard(JSON.stringify(bad), board.width, board.height)).toBeNull();
    expect(parseBoard('{', board.width, board.height)).toBeNull();
  });
});
