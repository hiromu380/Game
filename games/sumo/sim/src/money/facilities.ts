/**
 * 設備と契約の効果と費用
 */
import { FACILITIES, FACILITY_EFFECTS } from '../balance/facilities';
import { GAME } from '../balance/game';
import type { FacilityId, GameState } from '../model/types';

export const FACILITY_IDS: readonly FacilityId[] = ['dorm', 'dojo', 'trainer', 'scout'];

export const NO_FACILITIES: Record<FacilityId, number> = { dorm: 0, dojo: 0, trainer: 0, scout: 0 };

/** 部屋に住める力士の数 */
export function stableCapacity(state: GameState): number {
  return GAME.stableCapacity + state.player.facilities.dorm * FACILITY_EFFECTS.dormCapacityPerLevel;
}

/** 場所ごとの費用（建物の維持費 + 契約の費用） */
export function facilityUpkeep(f: Record<FacilityId, number>): number {
  let total = 0;
  for (const id of FACILITY_IDS) {
    const def = FACILITIES[id];
    const level = f[id];
    if (level === 0) continue;
    total += def.kind === 'build' ? def.upkeepPerLevel * level : def.costs[level - 1]!;
  }
  return total;
}

/** 建物を1段上げる費用（もう上げられなければ null） */
export function nextBuildCost(f: Record<FacilityId, number>, id: FacilityId): number | null {
  const def = FACILITIES[id];
  if (def.kind !== 'build') return null;
  return def.costs[f[id]] ?? null;
}
