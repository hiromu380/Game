/**
 * 画面全体の状態と操作（React の useReducer で使う純粋関数）
 *
 * ゲームのルール自体は @chain-factory/sim のラン進行関数に任せ、
 * ここでは「何を選択中か」「演出を再生中か」など UI の状態だけを扱う。
 *
 * 組み立て中の操作は操作ログ（RunOp）としても記録する。デイリーの本番ではこれをサーバーへ送り、
 * サーバーが同じ関数で再生して検証する（盤面や予算そのものは送らない）。
 */
import type { ApiErrorCode } from '@chain-factory/shared';
import {
  applyOp,
  applyRunToMeta,
  commitShift,
  createRun,
  getPart,
  metaToModifiers,
  runTrial,
  startOvertime,
  rotateCw,
  type Dir4,
  type MetaProgress,
  type PartId,
  type RunActionResult,
  type RunError,
  type RunOp,
  type RunState,
  type ShiftOutcome,
  type SimResult,
  type Unlock,
} from '@chain-factory/sim';

/** 選択状態: 手持ちのパーツ（配置待ち） or 盤面のマス */
export type Selection =
  { kind: 'inventory'; partId: PartId; dir: Dir4 } | { kind: 'cell'; x: number; y: number } | null;

/** 再生中（または再生終了後に結果表示中）の演出 */
export type Playback =
  | { mode: 'trial'; result: SimResult; finished: boolean }
  | {
      mode: 'commit';
      result: SimResult;
      finished: boolean;
      /** 確定後のラン（再生が終わって閉じたら run に反映する） */
      nextRun: RunState;
      outcome: ShiftOutcome;
    };

/**
 * 遊び方
 * - normal:   通常のラン（端末に保存・メタ進行に反映）
 * - daily:    デイリー本番（本番シードはサーバーから。ランキング対象。端末には保存しない）
 * - practice: デイリーの練習（同じ条件で何度でも。ランキング・メタ進行には反映しない）
 */
export type PlayMode =
  | { kind: 'normal' }
  | { kind: 'daily'; dailyId: string; number: number }
  | { kind: 'practice'; dailyId: string; number: number };

/** 画面に出すエラー（i18n の `error.<キー>`）。ラン操作のエラーと通信のエラー */
export type GameError = RunError | `online.${ApiErrorCode | 'network'}`;

export interface GameState {
  run: RunState;
  mode: PlayMode;
  /** 前回の本番以降の操作ログ（デイリーの本番でサーバーへ送る） */
  pendingOps: RunOp[];
  /** デイリーの本番でサーバーの応答を待っている */
  awaitingServer: boolean;
  selection: Selection;
  playback: Playback | null;
  /** 直近の操作エラー（i18n キーの一部） */
  error: GameError | null;
  /** 直近に再生した結果（デバッグ表示用。再生を閉じても残す） */
  lastResult: SimResult | null;
  /** メタ進行（ランをまたいで残る） */
  meta: MetaProgress;
  /** 直前に終わったランで新しく解放されたもの（結果画面で表示） */
  unlocks: Unlock[];
  /**
   * 直前の操作の手応え（効果音用）。seq が変わるたびに1回鳴らす。
   * reducer は純粋関数のまま、音を鳴らすのは画面側（App）に任せるための仕組み
   */
  feedback: { kind: FeedbackKind; seq: number } | null;
}

/** 操作の手応えの種類（サウンドマニフェストのキーと同じ名前） */
export type FeedbackKind = 'place' | 'rotate' | 'buy' | 'sell' | 'reroll' | 'returnPart' | 'error';

export type GameAction =
  | { type: 'newRun'; seed: number }
  /** デイリー・練習のランに入る / 通常のランに戻る */
  | { type: 'loadRun'; run: RunState; mode: PlayMode }
  /** 全シフトクリア後に延長戦へ進む */
  | { type: 'startOvertime' }
  | { type: 'buy'; offerIndex: number }
  | { type: 'selectInventory'; partId: PartId }
  | { type: 'clickCell'; x: number; y: number }
  /** 長押し（スマホ）: そのマスのパーツを手持ちに戻す */
  | { type: 'longPressCell'; x: number; y: number }
  | { type: 'rotate' }
  | { type: 'returnSelected' }
  | { type: 'sellSelected' }
  | { type: 'reroll' }
  | { type: 'startTrial' }
  | { type: 'startCommit' }
  /** デイリー: サーバーが検証して返した本番シードで確定する */
  | { type: 'serverCommitted'; seed: number }
  | { type: 'serverCommitFailed'; error: GameError }
  | { type: 'playbackFinished' }
  | { type: 'closePlayback' };

export function createGameState(
  run: RunState,
  meta: MetaProgress,
  mode: PlayMode = { kind: 'normal' },
): GameState {
  return {
    run,
    mode,
    pendingOps: [],
    awaitingServer: false,
    selection: null,
    playback: null,
    error: null,
    lastResult: null,
    meta,
    unlocks: [],
    feedback: null,
  };
}

/** 手応えを記録する */
function withFeedback(state: GameState, kind: FeedbackKind): GameState {
  return { ...state, feedback: { kind, seq: (state.feedback?.seq ?? 0) + 1 } };
}

/** ラン進行関数の結果を GameState に反映する（成功なら kind の手応え、失敗なら error） */
function applyRunResult(
  state: GameState,
  result: RunActionResult,
  kind: FeedbackKind,
  selection = state.selection,
): GameState {
  if (!result.ok) return withFeedback({ ...state, error: result.error }, 'error');
  return withFeedback({ ...state, run: result.state, selection, error: null }, kind);
}

/** 操作を1つ適用し、成功したら操作ログに記録する */
function applyRunOp(
  state: GameState,
  op: RunOp,
  kind: FeedbackKind,
  selection = state.selection,
): GameState {
  const result = applyOp(state.run, op);
  const next = applyRunResult(state, result, kind, selection);
  return result.ok ? { ...next, pendingOps: [...state.pendingOps, op] } : next;
}

/** 本番の結果を再生に渡す（シードは通常・練習なら省略、デイリーはサーバーから） */
function beginCommit(state: GameState, seed?: number): GameState {
  const committed = commitShift(state.run, seed === undefined ? {} : { seed });
  if ('error' in committed) return { ...state, awaitingServer: false, error: committed.error };
  // 通常のランは、終わったらその場でメタ進行に反映する（再生中にリロードされても実績が残るように）。
  // デイリー・練習は全員同じ条件で遊ぶモードなので、メタ進行には反映しない
  const recorded =
    state.mode.kind === 'normal'
      ? applyRunToMeta(state.meta, committed.state)
      : { meta: state.meta, unlocks: [], run: committed.state };
  return {
    ...state,
    meta: recorded.meta,
    unlocks: recorded.unlocks,
    pendingOps: [],
    awaitingServer: false,
    selection: null,
    error: null,
    lastResult: committed.result,
    playback: {
      mode: 'commit',
      result: committed.result,
      finished: false,
      nextRun: recorded.run,
      outcome: committed.outcome,
    },
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  // 演出の再生中・サーバーの応答待ちは、再生・応答に関する操作以外を受け付けない
  const busyAllowed = ['playbackFinished', 'closePlayback', 'newRun', 'loadRun'];
  if (state.playback && !busyAllowed.includes(action.type)) return state;
  if (state.awaitingServer && !['serverCommitted', 'serverCommitFailed'].includes(action.type)) {
    return state;
  }

  switch (action.type) {
    case 'newRun':
      // メタ進行（解放済みパーツ・工場拡張）を反映して始める
      return createGameState(
        createRun(action.seed, { meta: metaToModifiers(state.meta) }),
        state.meta,
      );

    case 'loadRun':
      return createGameState(action.run, state.meta, action.mode);

    case 'startOvertime': {
      const next = startOvertime(state.run);
      if (!next) return state;
      return { ...createGameState(next, state.meta, state.mode), lastResult: state.lastResult };
    }

    case 'buy': {
      // 購入したパーツをそのまま「配置待ち」にしておくと操作が速い
      const offer = state.run.shop[action.offerIndex];
      const selection: Selection = offer
        ? { kind: 'inventory', partId: offer.partId, dir: 1 }
        : null;
      return applyRunOp(state, { op: 'buy', offerIndex: action.offerIndex }, 'buy', selection);
    }

    case 'selectInventory':
      return {
        ...state,
        selection: { kind: 'inventory', partId: action.partId, dir: 1 },
        error: null,
      };

    case 'clickCell': {
      const { x, y } = action;
      const part = getPart(state.run.board, x, y);

      // 手持ちのパーツを選択中で空きマスをクリック → 配置
      if (state.selection?.kind === 'inventory' && part === null) {
        const { partId, dir } = state.selection;
        const next = applyRunOp(state, { op: 'place', partId, x, y, dir }, 'place');
        if (next.error) return next;
        // まだ同じパーツが手持ちにあれば続けて置けるよう選択を維持する
        const remaining = next.run.inventory[partId] ?? 0;
        return { ...next, selection: remaining > 0 ? state.selection : null };
      }
      // 選択中のパーツをもう一度クリック（タップ）→ 回転（スマホでも回せるように）
      if (
        part !== null &&
        state.selection?.kind === 'cell' &&
        state.selection.x === x &&
        state.selection.y === y
      ) {
        return applyRunOp(state, { op: 'rotate', x, y }, 'rotate');
      }
      // パーツのあるマス → そのマスを選択
      if (part !== null) return { ...state, selection: { kind: 'cell', x, y }, error: null };
      // 空きマス → 選択解除
      return { ...state, selection: null, error: null };
    }

    case 'rotate': {
      const sel = state.selection;
      if (sel?.kind === 'inventory')
        return withFeedback({ ...state, selection: { ...sel, dir: rotateCw(sel.dir) } }, 'rotate');
      if (sel?.kind === 'cell')
        return applyRunOp(state, { op: 'rotate', x: sel.x, y: sel.y }, 'rotate');
      return state;
    }

    case 'returnSelected': {
      // 手持ちに戻したパーツはそのまま「配置待ち」にして、移動を1クリックで済ませる
      const sel = state.selection;
      if (sel?.kind !== 'cell') return state;
      const part = getPart(state.run.board, sel.x, sel.y);
      const selection: Selection = part
        ? { kind: 'inventory', partId: part.id, dir: part.dir }
        : null;
      return applyRunOp(state, { op: 'return', x: sel.x, y: sel.y }, 'returnPart', selection);
    }

    case 'longPressCell': {
      // 長押ししたマスを選んだことにして「手持ちに戻す」と同じ処理をする
      if (!getPart(state.run.board, action.x, action.y)) return state;
      const selected: GameState = {
        ...state,
        selection: { kind: 'cell', x: action.x, y: action.y },
      };
      return gameReducer(selected, { type: 'returnSelected' });
    }

    case 'sellSelected': {
      const sel = state.selection;
      if (sel?.kind !== 'cell') return state;
      return applyRunOp(state, { op: 'sell', x: sel.x, y: sel.y }, 'sell', null);
    }

    case 'reroll':
      return applyRunOp(state, { op: 'reroll' }, 'reroll');

    case 'startTrial': {
      // 試運転ごとにシードが変わる（試運転回数が増えた run を保持する）
      const trial = runTrial(state.run);
      return {
        ...state,
        run: trial.state,
        playback: { mode: 'trial', result: trial.result, finished: false },
        lastResult: trial.result,
        error: null,
      };
    }

    case 'startCommit':
      // デイリー本番は本番シードをサーバーに求める（送信は画面側。応答で serverCommitted が来る）
      if (state.run.config.commitSeedMode === 'external') {
        return state.run.phase === 'building'
          ? { ...state, awaitingServer: true, error: null }
          : state;
      }
      return beginCommit(state);

    case 'serverCommitted':
      return state.awaitingServer ? beginCommit(state, action.seed) : state;

    case 'serverCommitFailed':
      return withFeedback({ ...state, awaitingServer: false, error: action.error }, 'error');

    case 'playbackFinished':
      return state.playback ? { ...state, playback: { ...state.playback, finished: true } } : state;

    case 'closePlayback': {
      const pb = state.playback;
      if (!pb) return state;
      if (pb.mode === 'commit') return { ...state, run: pb.nextRun, playback: null };
      return { ...state, playback: null };
    }
  }
}

/**
 * 保存すべきラン。本番の再生中はすでに結果が確定しているので、
 * リロードでやり直せないよう確定後のランを保存する。
 * デイリー・練習は端末に保存しない（デイリーはサーバーから再開する）ので null
 */
export function getPersistedRun(state: GameState): RunState | null {
  if (state.mode.kind !== 'normal') return null;
  return state.playback?.mode === 'commit' ? state.playback.nextRun : state.run;
}
