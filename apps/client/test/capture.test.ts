/**
 * 撮影モード: 盤面の JSON の読み込み
 */
import { createInitialMeta, createRun, getCurrentFloor } from '@chain-factory/sim';
import { CAPTURE_PRESETS } from '../src/config/capturePresets';
import { createGameState, gameReducer } from '../src/state/gameReducer';
import { describe, expect, it } from 'vitest';
import { parseBoard } from '../src/ui/CapturePanel';

describe('撮影モードの盤面の読み込み', () => {
  it('書き出した盤面はそのまま読める', () => {
    const board = createRun(1).board;
    const withPart = {
      ...board,
      cells: board.cells.map((c, i) => (i === 3 ? { id: 'gear', dir: 1 } : c)),
    };
    expect(parseBoard(JSON.stringify(withPart), board.width, board.height)).toEqual({
      board: withPart,
    });
  });

  it('床つきで書き出した盤面は、床も読める（知らない床は読まない）', () => {
    const run = createRun(1);
    const floor = getCurrentFloor(run);
    const text = JSON.stringify({ ...run.board, floor });
    expect(parseBoard(text, 7, 7)).toEqual({ board: run.board, floor });
    const bad = floor.map((c, i) => (i === 0 ? { tile: 'lava', source: 'stage' } : c));
    expect(parseBoard(JSON.stringify({ ...run.board, floor: bad }), 7, 7)).toBeNull();
  });

  it('床のプリセットを読み込むと、その日の床が差し替わり、床の効果つきで本番が再生できる', () => {
    const preset = CAPTURE_PRESETS.floor;
    let game = createGameState(createRun(1), createInitialMeta());
    game = gameReducer(game, {
      type: 'captureLoadBoard',
      board: preset.board,
      floor: preset.floor,
    });
    expect(getCurrentFloor(game.run)).toEqual(preset.floor);
    game = gameReducer(game, { type: 'captureCommit', seed: 1 });
    expect(game.playback?.result.score).toBe(2016n);
    expect(game.playback?.result.stats.floorApplied).toBe(5);
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
