/**
 * 手持ちの増減（0 個になったキーは消す）
 */
import type { PartId } from '../types';
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
