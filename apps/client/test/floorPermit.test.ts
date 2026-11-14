/**
 * ランダム配置権（画面側）: 使う操作が操作ログに残り、床が湧く。撮影モードで1枚もらえる
 */
import { countItems, createInitialMeta, createRun, getCurrentFloor } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { createGameState, gameReducer } from '../src/state/gameReducer';

describe('ランダム配置権の操作', () => {
  it('撮影モードで1枚もらい、使うと床が湧いて操作ログに残る（効果音つき）', () => {
    let game = createGameState(createRun(3), createInitialMeta());
    game = gameReducer(game, { type: 'captureGivePermit' });
    expect(countItems(game.run, 'floorPermit')).toBe(1);
    game = gameReducer(game, { type: 'useItem', itemId: 'floorPermit' });
    expect(countItems(game.run, 'floorPermit')).toBe(0);
    const cell = game.run.itemFloors!.cells[0]!;
    expect(getCurrentFloor(game.run)[cell.index]?.source).toBe('item');
    expect(game.pendingOps.at(-1)).toEqual({ op: 'useItem', itemId: 'floorPermit' });
    expect(game.feedback?.kind).toBe('useItem');
  });

  it('持っていなければ使えず、エラーになる', () => {
    const game = gameReducer(createGameState(createRun(3), createInitialMeta()), {
      type: 'useItem',
      itemId: 'floorPermit',
    });
    expect(game.error).toBe('noItem');
    expect(game.pendingOps).toEqual([]);
  });
});
