/**
 * ラン進行ロジック（すべて純粋関数。受け取った state は変更せず新しい state を返す）
 *
 * 流れ: createRun → [buyOffer / placePart / rotatePart / removePart / previewShift]* → commitShift → …
 */
import { BALANCE } from '../balance';
import { createEmptyBoard, getPart, isInside, setPart } from '../core/board';
import { rotateCw } from '../core/direction';
import { deriveSeed } from '../core/prng';
import { scoreCompare, scoreOf, scoreToString } from '../core/score';
import { simulate } from '../simulate/simulate';
import { createRuleSet } from '../simulate/rules';
import type { Dir4, PartId, SimResult } from '../types';
import { generateShop } from './shop';
import type { RunActionResult, RunError, RunState, ShiftOutcome } from './types';

/** 派生シードのラベル（値そのものに意味はなく、用途ごとに異なればよい） */
const SEED_LABEL_SIM = 1;
const SEED_LABEL_SHOP = 2;

type BalanceLike = typeof BALANCE;

const fail = (error: RunError): RunActionResult => ({ ok: false, error });
const ok = (state: RunState): RunActionResult => ({ ok: true, state });

/** シフトの設定（ノルマ・予算・報酬） */
export function getShiftConfig(shiftIndex: number, balance: BalanceLike = BALANCE) {
  const config = balance.run.shifts[shiftIndex];
  if (!config) throw new Error(`Invalid shift index: ${shiftIndex}`);
  return config;
}

export function getShiftCount(balance: BalanceLike = BALANCE): number {
  return balance.run.shifts.length;
}

/** そのシフトのシミュレーション用シード */
export function getShiftSimSeed(state: RunState): number {
  return deriveSeed(state.seed, SEED_LABEL_SIM, state.shiftIndex);
}

/** 新しいランを始める */
export function createRun(seed: number, balance: BalanceLike = BALANCE): RunState {
  const inventory: Partial<Record<PartId, number>> = { ...balance.run.starterKit };
  return {
    seed: seed >>> 0,
    shiftIndex: 0,
    phase: 'building',
    budget: getShiftConfig(0, balance).budget,
    board: createEmptyBoard(balance.board.width, balance.board.height),
    inventory,
    shop: generateShop(deriveSeed(seed >>> 0, SEED_LABEL_SHOP, 0), balance),
    history: [],
  };
}

/** ショップの商品を購入して手持ちに加える */
export function buyOffer(state: RunState, offerIndex: number): RunActionResult {
  if (state.phase !== 'building') return fail('notBuilding');
  const offer = state.shop[offerIndex];
  if (!offer) return fail('offerNotFound');
  if (offer.sold) return fail('alreadySold');
  if (state.budget < offer.price) return fail('notEnoughBudget');

  const shop = state.shop.map((o, i) => (i === offerIndex ? { ...o, sold: true } : o));
  return ok({
    ...state,
    budget: state.budget - offer.price,
    shop,
    inventory: addInventory(state.inventory, offer.partId, 1),
  });
}

/** 手持ちのパーツを盤面へ置く */
export function placePart(
  state: RunState,
  partId: PartId,
  x: number,
  y: number,
  dir: Dir4,
): RunActionResult {
  if (state.phase !== 'building') return fail('notBuilding');
  if (!isInside(state.board, x, y)) return fail('outOfBoard');
  if ((state.inventory[partId] ?? 0) <= 0) return fail('notInInventory');
  if (getPart(state.board, x, y) !== null) return fail('cellOccupied');

  return ok({
    ...state,
    board: setPart(state.board, x, y, { id: partId, dir }),
    inventory: addInventory(state.inventory, partId, -1),
  });
}

/** 盤面のパーツを時計回りに90度回転する（無料） */
export function rotatePart(state: RunState, x: number, y: number): RunActionResult {
  if (state.phase !== 'building') return fail('notBuilding');
  const part = getPart(state.board, x, y);
  if (!part) return fail('cellEmpty');
  return ok({ ...state, board: setPart(state.board, x, y, { ...part, dir: rotateCw(part.dir) }) });
}

/**
 * 盤面のパーツを撤去する。
 * 通常は価格の refundPercent% を返金（切り捨て）。スイッチ等は手持ちに戻る。
 */
export function removePart(
  state: RunState,
  x: number,
  y: number,
  balance: BalanceLike = BALANCE,
): RunActionResult {
  if (state.phase !== 'building') return fail('notBuilding');
  const part = getPart(state.board, x, y);
  if (!part) return fail('cellEmpty');

  const board = setPart(state.board, x, y, null);
  if (balance.run.returnToInventoryOnRemove.includes(part.id)) {
    return ok({ ...state, board, inventory: addInventory(state.inventory, part.id, 1) });
  }
  return ok({ ...state, board, budget: state.budget + getRefund(part.id, balance) });
}

/** 撤去したときの返金額 */
export function getRefund(partId: PartId, balance: BalanceLike = BALANCE): number {
  return Math.floor((balance.parts[partId].price * balance.run.refundPercent) / 100);
}

/**
 * 現在の盤面でスイッチを押した結果を計算する（試運転）。
 * state は変わらない。同じシフト・同じ盤面なら commitShift と同じ結果になる。
 */
export function previewShift(state: RunState, balance: BalanceLike = BALANCE): SimResult {
  return simulate({
    board: state.board,
    seed: getShiftSimSeed(state),
    rules: createRuleSet(balance),
  });
}

/**
 * スイッチを押してシフトを確定する。
 * ノルマ達成なら報酬と次シフトの予算を受け取り次へ（最終シフトならクリア）。未達ならラン終了。
 */
export function commitShift(
  state: RunState,
  balance: BalanceLike = BALANCE,
): { state: RunState; result: SimResult; outcome: ShiftOutcome } | { error: RunError } {
  if (state.phase !== 'building') return { error: 'notBuilding' };

  const result = previewShift(state, balance);
  const config = getShiftConfig(state.shiftIndex, balance);
  const cleared = scoreCompare(result.score, scoreOf(config.quota)) >= 0;
  const outcome: ShiftOutcome = { cleared, quota: config.quota, stats: result.stats };

  const history = [
    ...state.history,
    {
      shiftIndex: state.shiftIndex,
      score: scoreToString(result.score),
      quota: config.quota,
      cleared,
      chainCount: result.stats.chainCount,
    },
  ];

  if (!cleared) {
    return { state: { ...state, phase: 'failed', history }, result, outcome };
  }

  const nextIndex = state.shiftIndex + 1;
  if (nextIndex >= getShiftCount(balance)) {
    return { state: { ...state, phase: 'cleared', history }, result, outcome };
  }

  // 次のシフトへ: 盤面・手持ちは持ち越し、残予算 + 報酬 + 次シフト予算
  const nextState: RunState = {
    ...state,
    shiftIndex: nextIndex,
    budget: state.budget + config.clearReward + getShiftConfig(nextIndex, balance).budget,
    shop: generateShop(deriveSeed(state.seed, SEED_LABEL_SHOP, nextIndex), balance),
    history,
  };
  return { state: nextState, result, outcome };
}

/** ラン全体の最大連鎖数 */
export function getBestChain(state: RunState): number {
  return state.history.reduce((max, r) => Math.max(max, r.chainCount), 0);
}

function addInventory(
  inventory: RunState['inventory'],
  partId: PartId,
  delta: number,
): RunState['inventory'] {
  const count = (inventory[partId] ?? 0) + delta;
  const next = { ...inventory };
  if (count > 0) next[partId] = count;
  else delete next[partId];
  return next;
}
