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
  // 並び順（キーの順）は元のまま、partId だけを書き換える。
  // 0 個になったキーは最初から入れない（delete を使うとオブジェクトが遅い形になるため）
  const next: RunState['inventory'] = {};
  let found = false;
  for (const key of Object.keys(inventory) as PartId[]) {
    if (key === partId) {
      found = true;
      if (count > 0) next[key] = count;
    } else {
      next[key] = inventory[key];
    }
  }
  if (!found && count > 0) next[partId] = count;
  return next;
}
