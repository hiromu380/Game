/**
 * balance.ts からシミュレーション用の RuleSet を組み立てる
 */
import { BALANCE } from '../balance';
import { PART_IDS, type PartId, type RuleSet } from '../types';

export function createRuleSet(balance = BALANCE): RuleSet {
  const maxActivations = {} as Record<PartId, number | null>;
  for (const id of PART_IDS) maxActivations[id] = balance.parts[id].maxActivations;

  return {
    tickLimit: balance.sim.tickLimit,
    switchSignalValue: balance.sim.switchSignalValue,
    maxActivations,
    gearMultiplier: balance.effects.gearMultiplier,
    pressBase: balance.effects.pressBase,
    pressPerNeighbor: balance.effects.pressPerNeighbor,
  };
}

/** 既定のルール（balance.ts そのまま） */
export const DEFAULT_RULES: RuleSet = createRuleSet();
