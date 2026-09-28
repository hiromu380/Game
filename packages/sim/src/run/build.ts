/**
 * 組み立て中の操作: 購入・配置・回転・手持ちに戻す・売却・リロール
 * （すべて純粋関数。受け取った state は変更せず新しい state を返す）
 */
import { cellIndex, getPart, isInside, setPart } from '../core/board';
import { rotateCw } from '../core/direction';
import type { Dir4, PartId } from '../types';
import { addInventory } from './inventory';
import { shopSeed } from './seeds';
import { getCurrentEconomy, getCurrentRules } from './shift';
import { generateShop } from './shop';
import type { RunActionResult, RunError, RunState } from './types';

const fail = (error: RunError): RunActionResult => ({ ok: false, error });
const ok = (state: RunState): RunActionResult => ({ ok: true, state });

/** ショップの商品を購入して手持ちに加える */
export function buyOffer(state: RunState, offerIndex: number): RunActionResult {
  if (state.phase !== 'building') return fail('notBuilding');
  const offer = state.shop[offerIndex];
  if (!offer) return fail('offerNotFound');
  if (offer.sold) return fail('alreadySold');
  if (state.budget < offer.price) return fail('notEnoughBudget');

  return ok({
    ...state,
    budget: state.budget - offer.price,
    shop: state.shop.map((o, i) => (i === offerIndex ? { ...o, sold: true } : o)),
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
  if (getCurrentRules(state).blockedCells.includes(cellIndex(state.board, x, y))) {
    return fail('cellBlocked');
  }

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

/** 盤面のパーツを手持ちに戻す（無料・何度でも。パーツの移動に使う） */
export function returnPart(state: RunState, x: number, y: number): RunActionResult {
  if (state.phase !== 'building') return fail('notBuilding');
  const part = getPart(state.board, x, y);
  if (!part) return fail('cellEmpty');
  return ok({
    ...state,
    board: setPart(state.board, x, y, null),
    inventory: addInventory(state.inventory, part.id, 1),
  });
}

/** 売却したときの返金額（価格 × 返金率、切り捨て） */
export function getRefund(state: RunState, partId: PartId): number {
  const economy = state.config.economy;
  return Math.floor((economy.prices[partId] * economy.refundPercent) / 100);
}

/** 盤面のパーツを売却する。価格 0 のパーツ（スイッチ）は売れない */
export function sellPart(state: RunState, x: number, y: number): RunActionResult {
  if (state.phase !== 'building') return fail('notBuilding');
  const part = getPart(state.board, x, y);
  if (!part) return fail('cellEmpty');
  if (state.config.economy.prices[part.id] <= 0) return fail('cannotSell');
  return ok({
    ...state,
    board: setPart(state.board, x, y, null),
    budget: state.budget + getRefund(state, part.id),
  });
}

/** 次のリロールの価格。リロールできないシフトでは null */
export function getRerollCost(state: RunState): number | null {
  const { reroll } = getCurrentEconomy(state);
  if (!reroll.enabled) return null;
  return reroll.baseCost + reroll.costStep * state.rerollCount;
}

/** ショップの品揃えを引き直す（有料。同じシフト内でリロールするたびに値上がり） */
export function rerollShop(state: RunState): RunActionResult {
  if (state.phase !== 'building') return fail('notBuilding');
  const cost = getRerollCost(state);
  if (cost === null) return fail('rerollDisabled');
  if (state.budget < cost) return fail('notEnoughBudget');

  const rerollCount = state.rerollCount + 1;
  return ok({
    ...state,
    budget: state.budget - cost,
    rerollCount,
    shop: generateShop(
      shopSeed(state.seed, state.shiftIndex, rerollCount),
      getCurrentEconomy(state),
    ),
  });
}
