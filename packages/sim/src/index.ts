/**
 * @chain-factory/sim の公開API
 */
export * from './types';
export {
  BALANCE,
  type Balance,
  type BossModifierId,
  type DayEventId,
  type FloorParams,
  type ItemId,
  type MetaCondition,
  type PartBalance,
  type PartParams,
  type Rarity,
  type ShiftSpec,
} from './balance';

export { SIM_VERSION } from './version';
export * from './core/score';
export { createPrng, deriveSeed, hashString, type Prng } from './core/prng';
export * from './core/direction';
export * from './core/board';

export { simulate } from './simulate/simulate';
export * from './floor/types';
export * from './floor/layer';
export { FLOOR_BEHAVIORS } from './floor/tiles';
export { getPressMultiplier } from './simulate/parts/press';
export { getPartBadge, type PartBadge } from './simulate/badges';
export { computeActivationLimits } from './simulate/limits';

export { createRuleSet, DEFAULT_RULES } from './config/rules';
export {
  buildRunConfig,
  drawBoss,
  type BossPlanEntry,
  type EconomyConfig,
  type MetaModifiers,
  type RunConfig,
  type RunStages,
} from './config/runConfig';
export {
  BOSS_MODIFIERS,
  getShiftEconomy,
  getShiftFloor,
  getShiftRules,
} from './config/bossModifiers';
export {
  generateStage,
  parseTemplate,
  templateToFloor,
  transformFloor,
  validateStage,
} from './floor/stage';
export { drawFloorPermit, getCurrentFloor, isCellBlocked } from './run/floor';
export { addItem, countItems, expireItems, useFloorPermit } from './run/items';
export { buildWeeklyConfig, weeklyRunSeed, type WeeklyConfigInput } from './config/weekly';

export * from './run/types';
export {
  createWeeklyRun,
  createRun,
  createRunWithConfig,
  type CreateRunOptions,
} from './run/create';
export { applyOp, isRunOp, replayOps, type ReplayResult, type RunOp } from './run/ops';
export { activeEvent, chooseEvent, isEventPending } from './run/events';
export {
  buyOffer,
  getRefund,
  getRerollCost,
  mergeCells,
  mergeGolden,
  placePart,
  rerollShop,
  returnPart,
  rotatePart,
  sellPart,
} from './run/build';
export { goldenCount } from './run/inventory';
export { isUnmeasurable } from './run/unmeasurable';
export {
  abandonRun,
  commitShift,
  getCurrentEconomy,
  getCurrentRules,
  getCurrentShift,
  getDayAndPeriod,
  getShiftCount,
  isDayStart,
  runTrial,
  startOvertime,
} from './run/shift';
export { getBestChain, getTotalShipped } from './run/progress';
export { generateShop } from './run/shop';
export * as seeds from './run/seeds';

export { createInitialMeta, type MetaProgress, type MetaRecords } from './meta/types';
export {
  applyRunToMeta,
  conditionProgress,
  isConditionMet,
  isMainCleared,
  metaToModifiers,
  recordRun,
  type Unlock,
} from './meta/progress';

export * from './achievements';
