/**
 * 手持ちの増減（0 個になったキーは消す）
 */
import type { Part, PartId } from '../types';
import type { RunState } from './types';

export function addInventory(
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

/** 手持ちの金色パーツの数 */
export function goldenCount(state: RunState, partId: PartId): number {
  return state.goldenInventory?.[partId] ?? 0;
}

/** 盤面から外したパーツを手持ちに戻す（金色パーツは金色のまま戻す） */
export function returnToHand(state: RunState, part: Part): RunState {
  if (part.golden) {
    return { ...state, goldenInventory: addInventory(state.goldenInventory ?? {}, part.id, 1) };
  }
  return { ...state, inventory: addInventory(state.inventory, part.id, 1) };
}
