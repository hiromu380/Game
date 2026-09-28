/**
 * 基本の RuleSet（balance/ そのまま）を組み立てる
 *
 * ルールは「基本 → メタ進行 → ボス修正」の順に重ねる。ここは最初の層。
 */
import { BALANCE, type Balance } from '../balance';
import { PART_IDS, type PartId, type RuleSet } from '../types';

export function createRuleSet(balance: Balance = BALANCE): RuleSet {
  const maxActivations = {} as Record<PartId, number | null>;
  for (const id of PART_IDS) maxActivations[id] = balance.parts[id].maxActivations;

  return {
    tickLimit: balance.sim.tickLimit,
    switchSignalValue: balance.sim.switchSignalValue,
    maxActivations,
    params: { ...balance.partParams },
    blockedCells: [],
    dockDivisor: 1,
    maxIncomePerSim: balance.sim.maxIncomePerSim,
    maxLiveSignals: balance.sim.maxLiveSignals,
  };
}

/** 既定のルール（balance/ そのまま。テストや単体のシミュレーション用） */
export const DEFAULT_RULES: RuleSet = createRuleSet();
