import { createWeeklyRun, createInitialMeta, createRun, replayOps } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import {
  canUndo,
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

describe('操作ログと週替わりの本番', () => {
  // リロールを止める特殊ルール（部品不足）に当たらない週
  const weekly = () => {
    const run = createWeeklyRun('2026-10-12');
    return createGameState(run, createInitialMeta(), {
      kind: 'weekly',
      weekId: '2026-09-28',
      dayId: '2026-10-01',
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

  it('週替わりは本番でサーバーの応答を待ち、返ってきたシードで確定する', () => {
    let state = apply(
      weekly(),
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
    // 週替わりは端末に保存しない・メタ進行に反映しない
    expect(getPersistedRun(state)).toBeNull();
    expect(state.meta).toEqual(createInitialMeta());
  });

  it('サーバーが拒否したら操作ログを残したまま組み立てに戻る', () => {
    let state = apply(weekly(), { type: 'reroll' }, { type: 'startCommit' });
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

  it('週替わりの本番の確定で参加日数を数え、確定した結果発表の順位で上位の実績を判定する', () => {
    const run = createWeeklyRun('2026-10-12');
    let state = createGameState(run, createInitialMeta(), {
      kind: 'weekly',
      weekId: '2026-09-28',
      dayId: '2026-10-01',
      number: 1,
    });
    state = apply(state, { type: 'startCommit' }, { type: 'serverCommitted', seed: 1 });
    expect(state.achievements.dailyDays).toBe(1);
    expect(state.achievements.unlocked).toContain('ACH_DAILY_FIRST');
    state = apply(state, { type: 'weeklyRanked', topPercent: 50 });
    expect(state.achievements.unlocked).not.toContain('ACH_DAILY_TOP10');
    state = apply(state, { type: 'weeklyRanked', topPercent: 3 });
    expect(state.achievements.unlocked).toContain('ACH_DAILY_TOP10');
  });

  it('練習は週替わりの参加日数に数えない', () => {
    const run = createWeeklyRun('2026-10-12');
    let state = createGameState(
      { ...run, config: { ...run.config, commitSeedMode: 'derived' } },
      createInitialMeta(),
      { kind: 'practice', weekId: '2026-09-28', number: 1 },
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

describe('ドラッグで売却', () => {
  it('ショップへ落とすと売却され、予算が増えて操作ログに sell が残る', () => {
    const before = apply(
      createGameState(createRun(1), createInitialMeta()),
      { type: 'selectInventory', partId: 'dock' },
      { type: 'clickCell', x: 2, y: 2 },
    );
    const state = apply(before, { type: 'sellCell', x: 2, y: 2 });
    expect(state.run.board.cells[2 * 7 + 2]).toBeNull();
    expect(state.run.budget).toBeGreaterThan(before.run.budget);
    expect(state.pendingOps.at(-1)).toEqual({ op: 'sell', x: 2, y: 2 });
    expect(state.feedback?.kind).toBe('sell');
  });

  it('スイッチは売れない', () => {
    const state = apply(
      createGameState(createRun(1), createInitialMeta()),
      { type: 'selectInventory', partId: 'switch' },
      { type: 'clickCell', x: 0, y: 0 },
      { type: 'sellCell', x: 0, y: 0 },
    );
    expect(state.error).toBe('cannotSell');
    expect(state.run.board.cells[0]).not.toBeNull();
  });
});

describe('全部戻す', () => {
  it('盤面のパーツをすべて手持ちに戻し、1マスずつ「戻す」として記録する', () => {
    const before = apply(
      createGameState(createRun(1), createInitialMeta()),
      { type: 'selectInventory', partId: 'switch' },
      { type: 'clickCell', x: 1, y: 1 },
      { type: 'selectInventory', partId: 'dock' },
      { type: 'clickCell', x: 3, y: 1 },
    );
    const state = apply(before, { type: 'returnAll' });
    expect(state.run.board.cells.every((cell) => cell === null)).toBe(true);
    expect(state.run.inventory).toEqual(createRun(1).inventory);
    expect(state.selection).toBeNull();
    expect(state.pendingOps.slice(-2)).toEqual([
      { op: 'return', x: 1, y: 1 },
      { op: 'return', x: 3, y: 1 },
    ]);
    const replayed = replayOps(createRun(1), state.pendingOps);
    expect(replayed.ok && replayed.state).toEqual(state.run);
  });

  it('盤面が空なら何もしない', () => {
    const state = createGameState(createRun(1), createInitialMeta());
    expect(apply(state, { type: 'returnAll' })).toBe(state);
  });
});

describe('元に戻す', () => {
  const placed = () =>
    apply(
      createGameState(createRun(1), createInitialMeta()),
      { type: 'selectInventory', partId: 'switch' },
      { type: 'clickCell', x: 1, y: 1 },
      { type: 'selectInventory', partId: 'dock' },
      { type: 'clickCell', x: 3, y: 1 },
    );

  it('配置・回転・移動・全部戻すを1つずつ取り消し、操作ログも同じ位置まで戻す', () => {
    const start = createGameState(createRun(1), createInitialMeta());
    expect(canUndo(start)).toBe(false);
    const two = placed();
    const rotated = apply(two, { type: 'clickCell', x: 1, y: 1 }, { type: 'rotate' });
    const moved = apply(rotated, { type: 'movePart', from: { x: 3, y: 1 }, to: { x: 4, y: 2 } });
    const cleared = apply(moved, { type: 'returnAll' });
    expect(cleared.undo).toHaveLength(5);

    let state = apply(cleared, { type: 'undo' });
    expect(state.run).toEqual(moved.run);
    expect(state.pendingOps).toEqual(moved.pendingOps);
    state = apply(state, { type: 'undo' });
    expect(state.run).toEqual(rotated.run);
    state = apply(state, { type: 'undo' }, { type: 'undo' }, { type: 'undo' });
    expect(state.run).toEqual(start.run);
    expect(state.pendingOps).toEqual([]);
    expect(canUndo(state)).toBe(false);
    expect(apply(state, { type: 'undo' })).toBe(state);
    // 取り消したあとの操作ログを再生すると同じ状態になる（週替わりの検証とずれない）
    const mid = apply(cleared, { type: 'undo' }, { type: 'undo' });
    const replayed = replayOps(createRun(1), mid.pendingOps);
    expect(replayed.ok && replayed.state).toEqual(mid.run);
  });

  it('購入・売却・リロールのあとは戻せない（買い物のやり直しはできない）', () => {
    for (const action of [
      { type: 'buy', offerIndex: 0 },
      { type: 'reroll' },
      { type: 'sellCell', x: 3, y: 1 },
    ] satisfies GameAction[]) {
      const state = apply(placed(), action);
      expect(state.run).not.toEqual(placed().run);
      expect(canUndo(state)).toBe(false);
    }
  });

  it('試運転では履歴を消さず、試運転の回数は戻さない', () => {
    let state = apply(placed(), { type: 'startTrial' }, { type: 'closePlayback' });
    expect(state.undo).toHaveLength(2);
    const trials = state.run.trialCount;
    state = apply(state, { type: 'undo' });
    expect(state.run.trialCount).toBe(trials);
    expect(state.run.board.cells.filter(Boolean)).toHaveLength(1);
  });

  it('本番のあとは履歴を消す', () => {
    const state = apply(placed(), { type: 'startCommit' }, { type: 'closePlayback' });
    expect(state.undo).toEqual([]);
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

  it('週替わりの本番は諦められない', () => {
    const state = createGameState(createWeeklyRun('2026-10-12'), createInitialMeta(), {
      kind: 'weekly',
      weekId: '2026-09-28',
      dayId: '2026-10-01',
      number: 1,
    });
    expect(apply(state, { type: 'giveUp' })).toBe(state);
  });
});
