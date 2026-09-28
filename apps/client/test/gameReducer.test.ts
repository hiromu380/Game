import { createRun } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import {
  createGameState,
  gameReducer,
  getPersistedRun,
  type GameAction,
  type GameState,
} from '../src/state/gameReducer';

const apply = (state: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, state);

describe('画面の状態遷移', () => {
  it('手持ちを選んで空きマスをクリックすると配置、パーツのマスをクリックすると選択', () => {
    let state = createGameState(createRun(1));
    state = apply(
      state,
      { type: 'selectInventory', partId: 'switch' },
      { type: 'clickCell', x: 0, y: 0 },
    );
    expect(state.run.board.cells[0]).toEqual({ id: 'switch', dir: 1 });
    expect(state.selection).toBeNull();

    state = apply(state, { type: 'clickCell', x: 0, y: 0 }, { type: 'rotate' });
    expect(state.selection).toEqual({ kind: 'cell', x: 0, y: 0 });
    expect(state.run.board.cells[0]).toEqual({ id: 'switch', dir: 2 });
  });

  it('再生中は配置などの操作を受け付けない', () => {
    let state = apply(createGameState(createRun(1)), { type: 'startTrial' });
    const before = state;
    state = apply(state, { type: 'selectInventory', partId: 'dock' });
    expect(state).toBe(before);
  });

  it('本番の再生中は確定後のランを保存対象にし、閉じると反映される', () => {
    let state = apply(createGameState(createRun(1)), { type: 'startCommit' });
    expect(state.playback?.mode).toBe('commit');
    expect(getPersistedRun(state).phase).toBe('failed'); // 何も置いていないのでノルマ未達
    expect(state.run.phase).toBe('building'); // 表示は再生が終わるまで元のまま
    state = apply(state, { type: 'playbackFinished' }, { type: 'closePlayback' });
    expect(state.run.phase).toBe('failed');
  });
});
