/**
 * @chain-factory/sim の公開API
 */
export * from './types';
export {
  BALANCE,
  type Balance,
  type BossModifierId,
  type PartBalance,
  type PartParams,
  type Rarity,
  type ShiftSpec,
} from './balance';

export * from './core/score';
export { createPrng, deriveSeed, type Prng } from './core/prng';
export * from './core/direction';
export * from './core/board';

export { simulate } from './simulate/simulate';
export { getPressMultiplier } from './simulate/parts/press';

export { createRuleSet, DEFAULT_RULES } from './config/rules';
export {
  buildRunConfig,
  type BossPlanEntry,
  type EconomyConfig,
  type MetaModifiers,
  type RunConfig,
} from './config/runConfig';
export { BOSS_MODIFIERS, getShiftEconomy, getShiftRules } from './config/bossModifiers';

export * from './run/types';
export { createRun, type CreateRunOptions } from './run/create';
export {
  buyOffer,
  getRefund,
  getRerollCost,
  placePart,
  rerollShop,
  returnPart,
  rotatePart,
  sellPart,
} from './run/build';
export {
  commitShift,
  getCurrentEconomy,
  getCurrentRules,
  getCurrentShift,
  getDayAndPeriod,
  getShiftCount,
  runTrial,
} from './run/shift';
export { getBestChain, getTotalShipped } from './run/progress';
export { generateShop } from './run/shop';
export * as seeds from './run/seeds';

export { createInitialMeta, type MetaProgress, type MetaRecords } from './meta/types';
