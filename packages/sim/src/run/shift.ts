/**
 * シフトの進行: 試運転・本番・次のシフトへの移行
 */
import type { ShiftSpec } from '../balance';
import { getShiftEconomy, getShiftRules } from '../config/bossModifiers';
import type { EconomyConfig } from '../config/runConfig';
import { getPart, setPart } from '../core/board';
import { scoreCompare, scoreOf, scoreToString } from '../core/score';
import { simulate } from '../simulate/simulate';
import type { RuleSet, SimResult } from '../types';
import { addInventory } from './inventory';
import { commitSeed, shopSeed, trialSeed } from './seeds';
import { generateShop } from './shop';
import type { CommitResult, RunError, RunState, ShiftOutcome } from './types';

/** 現在のシフトの設定（ノルマ・予算・報酬・種類） */
export function getCurrentShift(state: RunState): ShiftSpec {
  const spec = state.config.shifts[state.shiftIndex];
  if (!spec) throw new Error(`Invalid shift index: ${state.shiftIndex}`);
  return spec;
}

export function getShiftCount(state: RunState): number {
  return state.config.shifts.length;
}

/** 何日目（0 始まり）の何シフト目（0=朝 1=昼 2=夜）か */
export function getDayAndPeriod(state: RunState, shiftIndex = state.shiftIndex) {
  const perDay = state.config.shiftsPerDay;
  return { day: Math.floor(shiftIndex / perDay), period: shiftIndex % perDay };
}

/** 現在のシフトで使うルール（ボス修正込み） */
export function getCurrentRules(state: RunState): RuleSet {
  return getShiftRules(state.config, state.shiftIndex);
}

/** 現在のシフトで使う経済設定（ボス修正込み） */
export function getCurrentEconomy(state: RunState): EconomyConfig {
  return getShiftEconomy(state.config, state.shiftIndex);
}

/**
 * 試運転: 現在の盤面でスイッチを押した結果を計算する。
 * 試運転ごとに異なるシードを使うため、ポンコツロボなどランダムな要素は毎回変わる。
 * 返す state は試運転回数が1増えただけで、盤面などは変わらない。
 */
export function runTrial(state: RunState): { state: RunState; result: SimResult } {
  const result = simulate({
    board: state.board,
    seed: trialSeed(state.seed, state.shiftIndex, state.trialCount),
    rules: getCurrentRules(state),
  });
  return { state: { ...state, trialCount: state.trialCount + 1 }, result };
}

/**
 * スイッチを押してシフトを確定する（本番シードを使う）。
 * ノルマ達成なら報酬・収入と次シフトの予算を受け取り次へ（最終シフトならクリア）。未達ならラン終了。
 */
export function commitShift(state: RunState): CommitResult | { error: RunError } {
  if (state.phase !== 'building') return { error: 'notBuilding' };

  const result = simulate({
    board: state.board,
    seed: commitSeed(state.seed, state.shiftIndex),
    rules: getCurrentRules(state),
  });
  const spec = getCurrentShift(state);
  const cleared = scoreCompare(result.score, scoreOf(spec.quota)) >= 0;
  const outcome: ShiftOutcome = {
    cleared,
    quota: spec.quota,
    income: result.income,
    stats: result.stats,
  };

  const history = [
    ...state.history,
    {
      shiftIndex: state.shiftIndex,
      score: scoreToString(result.score),
      quota: spec.quota,
      cleared,
      chainCount: result.stats.chainCount,
      income: result.income,
      boss: state.config.bossPlan[state.shiftIndex]?.id ?? null,
    },
  ];

  if (!cleared) return { state: { ...state, phase: 'failed', history }, result, outcome };

  const nextIndex = state.shiftIndex + 1;
  if (nextIndex >= getShiftCount(state)) {
    return { state: { ...state, phase: 'cleared', history }, result, outcome };
  }

  // 残予算 + 報酬 + 収入 を持ち越して次のシフトへ
  const carried = state.budget + spec.clearReward + result.income;
  return { state: enterShift({ ...state, history }, nextIndex, carried), result, outcome };
}

/**
 * シフトを開始する（ラン開始時と、シフト移行時に使う）
 * - 予算を受け取り、ショップを並べ、リロール・試運転の回数をリセットする
 * - 使用不可マス（ボス）に置かれたパーツは手持ちへ戻す
 */
export function enterShift(state: RunState, shiftIndex: number, carriedBudget: number): RunState {
  const spec = state.config.shifts[shiftIndex];
  if (!spec) throw new Error(`Invalid shift index: ${shiftIndex}`);

  let next: RunState = {
    ...state,
    shiftIndex,
    budget: carriedBudget + spec.budget,
    rerollCount: 0,
    trialCount: 0,
    shop: generateShop(
      shopSeed(state.seed, shiftIndex, 0),
      getShiftEconomy(state.config, shiftIndex),
    ),
  };

  for (const cell of getShiftRules(state.config, shiftIndex).blockedCells) {
    const x = cell % next.board.width;
    const y = Math.floor(cell / next.board.width);
    const part = getPart(next.board, x, y);
    if (!part) continue;
    next = {
      ...next,
      board: setPart(next.board, x, y, null),
      inventory: addInventory(next.inventory, part.id, 1),
    };
  }
  return next;
}
