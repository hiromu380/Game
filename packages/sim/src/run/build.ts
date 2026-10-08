/**
 * 組み立て中の操作: 購入・配置・回転・手持ちに戻す・売却・リロール
 * （すべて純粋関数。受け取った state は変更せず新しい state を返す）
 */
import { cellIndex, getPart, isInside, setPart } from '../core/board';
import { rotateCw } from '../core/direction';
import type { Dir4, PartId } from '../types';
import { isCellBlocked } from './floor';
import { addInventory, goldenCount, returnToHand } from './inventory';
import { addItem } from './items';
import { shopSeed } from './seeds';
import { getCurrentEconomy } from './shift';
import { generateShop, permitForShift } from './shop';
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

  const paid: RunState = {
    ...state,
    budget: state.budget - offer.price,
    shop: state.shop.map((o, i) => (i === offerIndex ? { ...o, sold: true } : o)),
  };
  // 消耗品（ランダム配置権）は消耗品の手持ちへ（持てる枚数を超えるなら買えない）
  if (offer.itemId !== undefined) return addItem(paid, offer.itemId);
  return ok({ ...paid, inventory: addInventory(state.inventory, offer.partId, 1) });
}

/** 手持ちのパーツを盤面へ置く（golden なら手持ちの金色パーツを置く） */
export function placePart(
  state: RunState,
  partId: PartId,
  x: number,
  y: number,
  dir: Dir4,
  golden = false,
): RunActionResult {
  if (state.phase !== 'building') return fail('notBuilding');
  if (!isInside(state.board, x, y)) return fail('outOfBoard');
  const have = golden ? goldenCount(state, partId) : (state.inventory[partId] ?? 0);
  if (have <= 0) return fail('notInInventory');
  if (getPart(state.board, x, y) !== null) return fail('cellOccupied');
  if (isCellBlocked(state, cellIndex(state.board, x, y))) {
    return fail('cellBlocked');
  }

  if (golden) {
    return ok({
      ...state,
      board: setPart(state.board, x, y, { id: partId, dir, golden: true }),
      goldenInventory: addInventory(state.goldenInventory ?? {}, partId, -1),
    });
  }
  return ok({
    ...state,
    board: setPart(state.board, x, y, { id: partId, dir }),
    inventory: addInventory(state.inventory, partId, -1),
  });
}

/**
 * (x, y) のパーツで合体するときに使うマス（先頭が (x, y)。金色になるマス）。合体できなければ null。
 * 同じ種類の普通のパーツが縦横に合体の数だけつながっているときに合体できる。
 * つながりが合体の数より多いときは、(x, y) から近い順（幅優先・上右下左の順）に選ぶ
 */
export function mergeCells(state: RunState, x: number, y: number): [number, number][] | null {
  const rule = state.config.golden;
  const part = isInside(state.board, x, y) ? getPart(state.board, x, y) : null;
  if (!rule || !part || part.golden || rule.excluded.includes(part.id)) return null;
  const group = connectedSameParts(state, x, y, part.id);
  return group.length >= rule.mergeCount ? group.slice(0, rule.mergeCount) : null;
}

/**
 * 合体: (x, y) のパーツを金色にし、つながった残りのパーツを取り除く（mergeCells）。
 * 盤面で同じパーツが3つつながると合体できる（自動では合体しない。一列に並べた組み方を崩さないため）
 */
export function mergeGolden(state: RunState, x: number, y: number): RunActionResult {
  if (state.phase !== 'building') return fail('notBuilding');
  const cells = mergeCells(state, x, y);
  const part = isInside(state.board, x, y) ? getPart(state.board, x, y) : null;
  if (!cells || !part) return fail('cannotMerge');
  let board = state.board;
  for (const [gx, gy] of cells.slice(1)) board = setPart(board, gx, gy, null);
  return ok({ ...state, board: setPart(board, x, y, { ...part, golden: true }) });
}

/** (x, y) から縦横につながった、同じ種類の普通のパーツのマス（幅優先・上右下左の順。先頭は (x, y)） */
function connectedSameParts(state: RunState, x: number, y: number, id: PartId): [number, number][] {
  const seen = new Set([cellIndex(state.board, x, y)]);
  const order: [number, number][] = [[x, y]];
  for (let i = 0; i < order.length; i++) {
    const [cx, cy] = order[i]!;
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ] as const) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!isInside(state.board, nx, ny)) continue;
      const index = cellIndex(state.board, nx, ny);
      if (seen.has(index)) continue;
      const neighbor = getPart(state.board, nx, ny);
      if (neighbor?.id !== id || neighbor.golden) continue;
      seen.add(index);
      order.push([nx, ny]);
    }
  }
  return order;
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
  return ok(returnToHand({ ...state, board: setPart(state.board, x, y, null) }, part));
}

/**
 * 売却したときの返金額（価格 × 返金率、切り捨て）。金色パーツは合体した数の分（普通のパーツ × 合体の数）
 */
export function getRefund(state: RunState, partId: PartId, golden = false): number {
  // 在庫整理（今日のイベント）で返金率が変わるので、今のシフトの経済設定を使う
  const economy = getCurrentEconomy(state);
  const one = Math.floor((economy.prices[partId] * economy.refundPercent) / 100);
  return golden ? one * (state.config.golden?.mergeCount ?? 1) : one;
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
    budget: state.budget + getRefund(state, part.id, part.golden === true),
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
      permitForShift(state.config, state.shiftIndex),
    ),
  });
}
