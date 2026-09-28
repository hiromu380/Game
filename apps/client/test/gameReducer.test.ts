import { createDailyRun, createInitialMeta, createRun, replayOps } from '@chain-factory/sim';
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

    // 選択中のパーツをもう一度タップ → 回転（スマホ操作）
    state = apply(state, { type: 'clickCell', x: 0, y: 0 });
    expect(state.run.board.cells[0]).toEqual({ id: 'switch', dir: 3 });
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
    expect(getPersistedRun(state)?.phase).toBe('failed'); // 何も置いていないのでノルマ未達
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
      { type: 'loadRun', run: createRun(2), mode: { kind: 'normal' } },
    );
    expect(state.meta.records.runsPlayed).toBe(1);
    expect(state.run.phase).toBe('building');
  });

  it('操作の手応え（効果音用）を記録する: 成功は操作の種類、失敗は error', () => {
    let state = createGameState(createRun(1), createInitialMeta());
    state = apply(
      state,
      { type: 'selectInventory', partId: 'dock' },
      { type: 'clickCell', x: 0, y: 0 },
    );
    expect(state.feedback).toEqual({ kind: 'place', seq: 1 });
    state = apply(state, { type: 'clickCell', x: 0, y: 0 }, { type: 'sellSelected' });
    expect(state.feedback?.kind).toBe('sell');
    state = apply(
      state,
      { type: 'selectInventory', partId: 'barrel' },
      { type: 'clickCell', x: 3, y: 3 },
    );
    expect(state.feedback?.kind).toBe('error');
    expect(state.feedback?.seq).toBe(3);
  });

  it('長押しでパーツを手持ちに戻し、そのまま配置待ちになる（スマホ操作）', () => {
    let state = createGameState(createRun(1), createInitialMeta());
    state = apply(
      state,
      { type: 'selectInventory', partId: 'dock' },
      { type: 'clickCell', x: 2, y: 2 },
      { type: 'longPressCell', x: 2, y: 2 },
    );
    expect(state.run.board.cells[2 * 7 + 2]).toBeNull();
    expect(state.selection).toMatchObject({ kind: 'inventory', partId: 'dock' });
    expect(state.feedback?.kind).toBe('returnPart');
  });
});

describe('操作ログとデイリー本番', () => {
  const daily = () => {
    const run = createDailyRun('2026-10-01');
    return createGameState(run, createInitialMeta(), {
      kind: 'daily',
      dailyId: '2026-10-01',
      number: 1,
    });
  };

  it('成功した操作だけが操作ログに記録され、再生すると同じ状態になる', () => {
    let state = createGameState(createRun(1), createInitialMeta());
    state = apply(
      state,
      { type: 'selectInventory', partId: 'switch' },
      { type: 'clickCell', x: 1, y: 1 },
      { type: 'clickCell', x: 1, y: 1 },
      { type: 'rotate' }, // 盤面のパーツを回転
      { type: 'selectInventory', partId: 'dock' },
      { type: 'clickCell', x: 1, y: 1 }, // 埋まっているマスへの配置は失敗（記録しない）
      { type: 'buy', offerIndex: 99 }, // 存在しない商品（記録しない）
      { type: 'reroll' },
    );
    expect(state.pendingOps.map((op) => op.op)).toEqual(['place', 'rotate', 'reroll']);
    const replayed = replayOps(createRun(1), state.pendingOps);
    expect(replayed.ok && replayed.state).toEqual(state.run);
  });

  it('デイリーは本番でサーバーの応答を待ち、返ってきたシードで確定する', () => {
    let state = apply(
      daily(),
      { type: 'selectInventory', partId: 'switch' },
      { type: 'clickCell', x: 1, y: 3 },
      { type: 'startCommit' },
    );
    expect(state.awaitingServer).toBe(true);
    expect(state.playback).toBeNull();
    // 応答待ちの間は操作できない
    expect(apply(state, { type: 'reroll' })).toBe(state);

    state = apply(state, { type: 'serverCommitted', seed: 123 });
    expect(state.awaitingServer).toBe(false);
    expect(state.playback?.mode).toBe('commit');
    expect(state.pendingOps).toEqual([]);
    // デイリーは端末に保存しない・メタ進行に反映しない
    expect(getPersistedRun(state)).toBeNull();
    expect(state.meta).toEqual(createInitialMeta());
  });

  it('サーバーが拒否したら操作ログを残したまま組み立てに戻る', () => {
    let state = apply(daily(), { type: 'reroll' }, { type: 'startCommit' });
    state = apply(state, { type: 'serverCommitFailed', error: 'online.network' });
    expect(state).toMatchObject({ awaitingServer: false, error: 'online.network', playback: null });
    expect(state.pendingOps).toEqual([{ op: 'reroll' }]);
  });
});

describe('実績', () => {
  it('本番の結果で解除し、ランを替えても残る', () => {
    // 何も置かずに本番 → 出荷量 0（隠し実績）
    let state = apply(createGameState(createRun(1), createInitialMeta()), { type: 'startCommit' });
    expect(state.achievements.unlocked).toEqual(['ACH_ZERO']);
    state = apply(state, { type: 'loadRun', run: createRun(2), mode: { kind: 'normal' } });
    expect(state.achievements.unlocked).toEqual(['ACH_ZERO']);
  });

  it('デイリー本番の確定で参加日数を数え、ランキングの順位で上位の実績を判定する', () => {
    const run = createDailyRun('2026-10-01');
    let state = createGameState(run, createInitialMeta(), {
      kind: 'daily',
      dailyId: '2026-10-01',
      number: 1,
    });
    state = apply(state, { type: 'startCommit' }, { type: 'serverCommitted', seed: 1 });
    expect(state.achievements.dailyDays).toBe(1);
    expect(state.achievements.unlocked).toContain('ACH_DAILY_FIRST');
    state = apply(state, { type: 'dailyRanked', topPercent: 50 });
    expect(state.achievements.unlocked).not.toContain('ACH_DAILY_TOP10');
    state = apply(state, { type: 'dailyRanked', topPercent: 3 });
    expect(state.achievements.unlocked).toContain('ACH_DAILY_TOP10');
  });

  it('練習はデイリーの参加日数に数えない', () => {
    const run = createDailyRun('2026-10-01');
    let state = createGameState(
      { ...run, config: { ...run.config, commitSeedMode: 'derived' } },
      createInitialMeta(),
      { kind: 'practice', dailyId: '2026-10-01', number: 1 },
    );
    state = apply(state, { type: 'startCommit' });
    expect(state.achievements.dailyDays).toBe(0);
  });
});

describe('ドラッグでの移動', () => {
  const placed = () =>
    apply(
      createGameState(createRun(1), createInitialMeta()),
      { type: 'selectInventory', partId: 'gear' },
      { type: 'clickCell', x: 1, y: 1 },
      { type: 'rotate' }, // 置いたギアを選んで回す（向きを変えておく）
      { type: 'selectInventory', partId: 'dock' },
      { type: 'clickCell', x: 3, y: 1 },
    );

  it('空きマスへ動かすと向きはそのまま。操作ログは「戻す → 置く」で、再生すると同じ盤面になる', () => {
    const before = placed();
    const gear = before.run.board.cells[1 * before.run.board.width + 1]!;
    const state = apply(before, { type: 'movePart', from: { x: 1, y: 1 }, to: { x: 2, y: 4 } });
    const width = state.run.board.width;
    expect(state.run.board.cells[1 * width + 1]).toBeNull();
    expect(state.run.board.cells[4 * width + 2]).toEqual(gear);
    expect(state.selection).toEqual({ kind: 'cell', x: 2, y: 4 });
    expect(state.pendingOps.slice(-2).map((op) => op.op)).toEqual(['return', 'place']);
    const replayed = replayOps(createRun(1), state.pendingOps);
    expect(replayed.ok && replayed.state.board).toEqual(state.run.board);
  });

  it('ふさがっているマスへは動かせない（盤面も操作ログも変わらない）', () => {
    const before = placed();
    const state = apply(before, { type: 'movePart', from: { x: 1, y: 1 }, to: { x: 3, y: 1 } });
    expect(state.run).toBe(before.run);
    expect(state.pendingOps).toBe(before.pendingOps);
    expect(state.error).toBe('cellOccupied');
  });
});

describe('諦める', () => {
  it('通常ランは脱落で終わり、確定したシフトの分をメタ進行に記録する', () => {
    let state = apply(createGameState(createRun(1), createInitialMeta()), { type: 'startCommit' });
    state = apply(state, { type: 'playbackFinished' }, { type: 'closePlayback' });
    // 何も置かずに本番 → ノルマ未達で終わるので、別のランで試す
    state = apply(state, { type: 'loadRun', run: createRun(2), mode: { kind: 'normal' } });
    const before = state.meta.records.runsPlayed;
    state = apply(state, { type: 'giveUp' });
    expect(state.run.phase).toBe('failed');
    // 1シフトも確定していないランは記録しない
    expect(state.meta.records.runsPlayed).toBe(before);
  });

  it('デイリー本番は諦められない', () => {
    const state = createGameState(createDailyRun('2026-10-01'), createInitialMeta(), {
      kind: 'daily',
      dailyId: '2026-10-01',
      number: 1,
    });
    expect(apply(state, { type: 'giveUp' })).toBe(state);
  });
});
