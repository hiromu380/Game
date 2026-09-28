import { createInitialMeta, createRun } from '@chain-factory/sim';
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
    let state = createGameState(createRun(1), createInitialMeta());
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
    let state = apply(createGameState(createRun(1), createInitialMeta()), { type: 'startTrial' });
    const before = state;
    state = apply(state, { type: 'selectInventory', partId: 'dock' });
    expect(state).toBe(before);
  });

  it('本番の再生中は確定後のランを保存対象にし、閉じると反映される', () => {
    let state = apply(createGameState(createRun(1), createInitialMeta()), { type: 'startCommit' });
    expect(state.playback?.mode).toBe('commit');
    expect(getPersistedRun(state).phase).toBe('failed'); // 何も置いていないのでノルマ未達
    expect(state.run.phase).toBe('building'); // 表示は再生が終わるまで元のまま
    state = apply(state, { type: 'playbackFinished' }, { type: 'closePlayback' });
    expect(state.run.phase).toBe('failed');
  });

  it('試運転するたびに試運転回数が増える（シードが変わる）', () => {
    let state = createGameState(createRun(1), createInitialMeta());
    state = apply(
      state,
      { type: 'startTrial' },
      { type: 'playbackFinished' },
      { type: 'closePlayback' },
    );
    state = apply(state, { type: 'startTrial' });
    expect(state.run.trialCount).toBe(2);
  });

  it('手持ちに戻すとそのまま配置待ちになり、別のマスへ移動できる', () => {
    let state = createGameState(createRun(1), createInitialMeta());
    state = apply(
      state,
      { type: 'selectInventory', partId: 'dock' },
      { type: 'clickCell', x: 1, y: 1 },
      { type: 'clickCell', x: 1, y: 1 },
      { type: 'returnSelected' },
    );
    expect(state.selection).toEqual({ kind: 'inventory', partId: 'dock', dir: 1 });
    state = apply(state, { type: 'clickCell', x: 4, y: 4 });
    expect(state.run.board.cells[4 * 7 + 4]).toEqual({ id: 'dock', dir: 1 });
    expect(state.run.board.cells[1 * 7 + 1]).toBeNull();
  });

  it('売却すると予算が増え、スイッチは売却できない', () => {
    let state = createGameState(createRun(1), createInitialMeta());
    state = apply(
      state,
      { type: 'selectInventory', partId: 'dock' },
      { type: 'clickCell', x: 0, y: 0 },
      { type: 'clickCell', x: 0, y: 0 },
    );
    const budget = state.run.budget;
    state = apply(state, { type: 'sellSelected' });
    expect(state.run.budget).toBeGreaterThan(budget);

    state = apply(
      state,
      { type: 'selectInventory', partId: 'switch' },
      { type: 'clickCell', x: 0, y: 0 },
      { type: 'clickCell', x: 0, y: 0 },
      { type: 'sellSelected' },
    );
    expect(state.error).toBe('cannotSell');
  });

  it('リロールで品揃えが変わり、予算が減る', () => {
    const before = createGameState(createRun(1), createInitialMeta());
    const after = apply(before, { type: 'reroll' });
    expect(after.run.rerollCount).toBe(1);
    expect(after.run.budget).toBeLessThan(before.run.budget);
  });

  it('ランが終わるとメタ進行に記録され、次のランに反映される', () => {
    let state = apply(createGameState(createRun(1), createInitialMeta()), { type: 'startCommit' });
    expect(state.meta.records.runsPlayed).toBe(1);
    state = apply(
      state,
      { type: 'playbackFinished' },
      { type: 'closePlayback' },
      { type: 'newRun', seed: 2 },
    );
    expect(state.meta.records.runsPlayed).toBe(1);
    expect(state.run.phase).toBe('building');
  });
});
