/**
 * 画面全体の状態と操作（React の useReducer で使う純粋関数）
 *
 * ゲームのルール自体は @chain-factory/sim のラン進行関数に任せ、
 * ここでは「何を選択中か」「演出を再生中か」など UI の状態だけを扱う。
 */
import {
  buyOffer,
  commitShift,
  createRun,
  getPart,
  placePart,
  previewShift,
  removePart,
  rotateCw,
  rotatePart,
  type Dir4,
  type PartId,
  type RunActionResult,
  type RunError,
  type RunState,
  type ShiftOutcome,
  type SimResult,
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

export interface GameState {
  run: RunState;
  selection: Selection;
  playback: Playback | null;
  /** 直近の操作エラー（i18n キーの一部） */
  error: RunError | null;
}

export type GameAction =
  | { type: 'newRun'; seed: number }
  | { type: 'buy'; offerIndex: number }
  | { type: 'selectInventory'; partId: PartId }
  | { type: 'clickCell'; x: number; y: number }
  | { type: 'rotate' }
  | { type: 'removeSelected' }
  | { type: 'startTrial' }
  | { type: 'startCommit' }
  | { type: 'playbackFinished' }
  | { type: 'closePlayback' };

export function createGameState(run: RunState): GameState {
  return { run, selection: null, playback: null, error: null };
}

/** ラン進行関数の結果を GameState に反映する */
function applyRunResult(state: GameState, result: RunActionResult, selection = state.selection) {
  if (!result.ok) return { ...state, error: result.error };
  return { ...state, run: result.state, selection, error: null };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  // 演出の再生中は、再生に関する操作以外を受け付けない
  if (state.playback && !['playbackFinished', 'closePlayback', 'newRun'].includes(action.type)) {
    return state;
  }

  switch (action.type) {
    case 'newRun':
      return createGameState(createRun(action.seed));

    case 'buy': {
      const result = buyOffer(state.run, action.offerIndex);
      // 購入したパーツをそのまま「配置待ち」にしておくと操作が速い
      const offer = state.run.shop[action.offerIndex];
      const selection: Selection = offer
        ? { kind: 'inventory', partId: offer.partId, dir: 1 }
        : null;
      return applyRunResult(state, result, selection);
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
        const result = placePart(state.run, partId, x, y, dir);
        if (!result.ok) return { ...state, error: result.error };
        // まだ同じパーツが手持ちにあれば続けて置けるよう選択を維持する
        const remaining = result.state.inventory[partId] ?? 0;
        return applyRunResult(state, result, remaining > 0 ? state.selection : null);
      }
      // パーツのあるマス → そのマスを選択
      if (part !== null) return { ...state, selection: { kind: 'cell', x, y }, error: null };
      // 空きマス → 選択解除
      return { ...state, selection: null, error: null };
    }

    case 'rotate': {
      const sel = state.selection;
      if (sel?.kind === 'inventory')
        return { ...state, selection: { ...sel, dir: rotateCw(sel.dir) } };
      if (sel?.kind === 'cell') return applyRunResult(state, rotatePart(state.run, sel.x, sel.y));
      return state;
    }

    case 'removeSelected': {
      const sel = state.selection;
      if (sel?.kind !== 'cell') return state;
      return applyRunResult(state, removePart(state.run, sel.x, sel.y), null);
    }

    case 'startTrial':
      return {
        ...state,
        playback: { mode: 'trial', result: previewShift(state.run), finished: false },
        error: null,
      };

    case 'startCommit': {
      const committed = commitShift(state.run);
      if ('error' in committed) return { ...state, error: committed.error };
      return {
        ...state,
        selection: null,
        error: null,
        playback: {
          mode: 'commit',
          result: committed.result,
          finished: false,
          nextRun: committed.state,
          outcome: committed.outcome,
        },
      };
    }

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
 */
export function getPersistedRun(state: GameState): RunState {
  return state.playback?.mode === 'commit' ? state.playback.nextRun : state.run;
}
