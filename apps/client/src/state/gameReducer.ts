/**
 * 画面全体の状態と操作（React の useReducer で使う純粋関数）
 *
 * ゲームのルール自体は @chain-factory/sim のラン進行関数に任せ、
 * ここでは「何を選択中か」「演出を再生中か」など UI の状態だけを扱う。
 *
 * 組み立て中の操作は操作ログ（RunOp）としても記録する。デイリーの本番ではこれをサーバーへ送り、
 * サーバーが同じ関数で再生して検証する（盤面や予算そのものは送らない）。
 */
import type { OnlineErrorCode } from '../online/api';
import {
  abandonRun,
  addItem,
  BALANCE,
  applyOp,
  applyRunToMeta,
  commitShift,
  createInitialAchievements,
  getPart,
  runTrial,
  startOvertime,
  rotateCw,
  type AchievementProgress,
  type Board,
  type Dir4,
  type FloorLayer,
  type ItemId,
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
import { achievementsAfterCommit, achievementsAfterRanking } from './achievements';

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
export type GameError = RunError | `online.${OnlineErrorCode}`;

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
  /** 実績（解除済み・デイリーの参加日数。ランをまたいで残る） */
  achievements: AchievementProgress;
  /**
   * 直前の操作の手応え（効果音用）。seq が変わるたびに1回鳴らす。
   * reducer は純粋関数のまま、音を鳴らすのは画面側（App）に任せるための仕組み
   */
  feedback: { kind: FeedbackKind; seq: number } | null;
}

/** 操作の手応えの種類（サウンドマニフェストのキーと同じ名前） */
export type FeedbackKind =
  'place' | 'rotate' | 'buy' | 'sell' | 'reroll' | 'returnPart' | 'useItem' | 'error';

export type GameAction =
  /**
   * 新しいラン・デイリー・練習に入る / 通常のランに戻る。
   * ランの組み立て（相場・体験版の制限など）は画面側で行う（state/newRun.ts、online/dailyRun.ts）
   */
  | { type: 'loadRun'; run: RunState; mode: PlayMode }
  /** 全シフトクリア後に延長戦へ進む */
  | { type: 'startOvertime' }
  /** ランを諦める（通常ラン・練習だけ。デイリー本番はサーバーに記録が残るので諦められない） */
  | { type: 'giveUp' }
  | { type: 'buy'; offerIndex: number }
  /** 消耗品を使う（ランダム配置権: 盤面のどこかに床が湧く） */
  | { type: 'useItem'; itemId: ItemId }
  /** 撮影モード: 配置権を1枚もらう（使う場面の確認・録画用） */
  | { type: 'captureGivePermit' }
  | { type: 'selectInventory'; partId: PartId }
  | { type: 'clickCell'; x: number; y: number }
  /** 長押し（スマホ）・ダブルクリック: そのマスのパーツを手持ちに戻す */
  | { type: 'longPressCell'; x: number; y: number }
  /** ドラッグ: 置いたパーツを空きマスへ動かす（向きはそのまま） */
  | { type: 'movePart'; from: { x: number; y: number }; to: { x: number; y: number } }
  | { type: 'rotate' }
  /** 選択を解除する（コントローラーの B・Esc） */
  | { type: 'deselect' }
  | { type: 'returnSelected' }
  /** 盤面のパーツをすべて手持ちに戻す */
  | { type: 'returnAll' }
  | { type: 'sellSelected' }
  /** 盤面のパーツを売却する（ショップへドラッグしたとき） */
  | { type: 'sellCell'; x: number; y: number }
  | { type: 'reroll' }
  /** 今日のイベント（2日目以降の朝）を候補から選ぶ */
  | { type: 'chooseEvent'; index: number }
  | { type: 'startTrial' }
  | { type: 'startCommit' }
  /** デイリー: サーバーが検証して返した本番シードで確定する */
  | { type: 'serverCommitted'; seed: number }
  | { type: 'serverCommitFailed'; error: GameError }
  | { type: 'playbackFinished' }
  | { type: 'closePlayback' }
  /** デイリーのランキングで自分の順位を受け取った（上位○% の実績） */
  | { type: 'dailyRanked'; topPercent: number }
  /** 撮影モード: 盤面を差し替える（書き出した JSON の読み込み。ui/CapturePanel.tsx） */
  | { type: 'captureLoadBoard'; board: Board; floor?: FloorLayer }
  /** 撮影モード: 指定したシードで本番を実行する（見栄えの良い連鎖を何度でも再現する） */
  | { type: 'captureCommit'; seed: number };

export function createGameState(
  run: RunState,
  meta: MetaProgress,
  mode: PlayMode = { kind: 'normal' },
  achievements: AchievementProgress = createInitialAchievements(),
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
    achievements,
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
  const achievements = achievementsAfterCommit(state.achievements, {
    mode: state.mode,
    before: state.run,
    committed,
    meta: recorded.meta === state.meta ? undefined : recorded.meta,
  });
  return {
    ...state,
    meta: recorded.meta,
    unlocks: recorded.unlocks,
    achievements,
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
  const busyAllowed = ['playbackFinished', 'closePlayback', 'loadRun', 'dailyRanked'];
  if (state.playback && !busyAllowed.includes(action.type)) return state;
  if (
    state.awaitingServer &&
    !['serverCommitted', 'serverCommitFailed', 'dailyRanked'].includes(action.type)
  ) {
    return state;
  }

  switch (action.type) {
    case 'loadRun':
      return createGameState(action.run, state.meta, action.mode, state.achievements);

    case 'dailyRanked':
      return {
        ...state,
        achievements: achievementsAfterRanking(state.achievements, action.topPercent),
      };

    case 'startOvertime': {
      const next = startOvertime(state.run);
      if (!next) return state;
      return {
        ...createGameState(next, state.meta, state.mode, state.achievements),
        lastResult: state.lastResult,
      };
    }

    case 'buy': {
      // 購入したパーツをそのまま「配置待ち」にしておくと操作が速い
      const offer = state.run.shop[action.offerIndex];
      const selection: Selection = offer?.partId
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

    case 'giveUp': {
      if (state.mode.kind === 'daily') return state;
      const given = abandonRun(state.run);
      if (!given) return state;
      // 通常ランは、確定したシフトの分だけメタ進行に記録する（本番の確定と同じ扱い）
      const recorded =
        state.mode.kind === 'normal'
          ? applyRunToMeta(state.meta, given)
          : { meta: state.meta, unlocks: [], run: given };
      return {
        ...state,
        run: recorded.run,
        meta: recorded.meta,
        unlocks: recorded.unlocks,
        selection: null,
        error: null,
      };
    }

    case 'deselect':
      return state.selection ? { ...state, selection: null, error: null } : state;

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

    case 'returnAll': {
      // 1マスずつ「手持ちに戻す」操作として記録する（デイリーのサーバー検証で同じように再生できるように）
      const { board } = state.run;
      let next: GameState = { ...state, selection: null };
      let returned = 0;
      for (let y = 0; y < board.height; y++) {
        for (let x = 0; x < board.width; x++) {
          if (!getPart(board, x, y)) continue;
          next = applyRunOp(next, { op: 'return', x, y }, 'returnPart', null);
          if (next.error) return next;
          returned++;
        }
      }
      return returned > 0 ? next : state;
    }

    case 'movePart': {
      // 「手持ちに戻す → 置く」の2つの操作として記録する（デイリーのサーバー検証で同じように再生できるように）
      const { from, to } = action;
      const part = getPart(state.run.board, from.x, from.y);
      if (!part || (from.x === to.x && from.y === to.y)) return state;
      if (getPart(state.run.board, to.x, to.y)) {
        return withFeedback({ ...state, error: 'cellOccupied' }, 'error');
      }
      const returned = applyRunOp(state, { op: 'return', x: from.x, y: from.y }, 'place');
      if (returned.error) return returned;
      const placed = applyRunOp(
        returned,
        { op: 'place', partId: part.id, x: to.x, y: to.y, dir: part.dir },
        'place',
      );
      // 置けなかった（工事中のマスなど）ときは、動かす前に戻す
      if (placed.error) return withFeedback({ ...state, error: placed.error }, 'error');
      return { ...placed, selection: { kind: 'cell', x: to.x, y: to.y } };
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

    case 'sellCell': {
      if (!getPart(state.run.board, action.x, action.y)) return state;
      return applyRunOp(state, { op: 'sell', x: action.x, y: action.y }, 'sell', null);
    }

    case 'chooseEvent':
      return applyRunOp(state, { op: 'chooseEvent', index: action.index }, 'buy', null);

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

    case 'captureLoadBoard':
      return state.run.phase === 'building'
        ? {
            ...state,
            run: withCaptureFloor({ ...state.run, board: action.board }, action.floor),
            selection: null,
            error: null,
          }
        : state;

    case 'useItem':
      return applyRunOp(state, { op: 'useItem', itemId: action.itemId }, 'useItem');

    case 'captureGivePermit': {
      if (state.run.phase !== 'building') return state;
      const given = addItem(state.run, 'floorPermit');
      return given.ok ? { ...state, run: given.state, error: null } : state;
    }

    case 'captureCommit':
      return state.run.phase === 'building' ? beginCommit(state, action.seed) : state;

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

/**
 * 撮影モード: その日の床を、読み込んだ床に差し替える（ボーナス床・出来事の床は消す）。
 * 撮影専用で、通常のプレイでは使わない（床はランシードから決まる）
 */
function withCaptureFloor(run: RunState, floor: FloorLayer | undefined): RunState {
  if (!floor) return run;
  const perDay = run.config.shiftsPerDay;
  const day = Math.floor(run.shiftIndex / perDay);
  const stages = run.config.stages ?? { days: [], balance: BALANCE.stages };
  const days = [...stages.days];
  days[day] = floor;
  return {
    ...run,
    config: { ...run.config, stages: { ...stages, days } },
    bonusFloor: null,
    dayEvent: run.dayEvent ? { ...run.dayEvent, floorChanges: [] } : run.dayEvent,
  };
}
