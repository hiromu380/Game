/**
 * レリック: 夜（ボス）のシフトをクリアすると、次のシフトの開始時に3つの候補から1つ選ぶ。
 * 選んだレリックはランの終わりまでずっと効く（売却・入れ替えはない）
 *
 * - 候補はランシードと日から決まる（relicSeed）。持っているレリックは候補に出ない
 * - 選ぶまで、ほかの操作と本番はできない（今日の出来事と同じ）
 * - 効果は、ルール（getCurrentRules）・経済（getCurrentEconomy）・シフトの報酬（getCurrentShift）・
 *   ボーナス床の枚数（drawBonusFloor）に重ねる
 */
import type { RelicId, RelicParams, ShiftSpec } from '../balance';
import type { EconomyConfig } from '../config/runConfig';
import { createPrng } from '../core/prng';
import { PART_IDS, type RuleSet } from '../types';
import { relicSeed } from './seeds';
import type { RunActionResult, RunState } from './types';

/** レリックの候補を抽選する（重みつき・重複なし。持っているものは除く） */
export function drawRelicChoice(state: RunState, day: number): RelicId[] {
  const config = state.config.relics;
  if (!config) return [];
  const owned = new Set(state.relics ?? []);
  const pool = (Object.keys(config.weights) as RelicId[])
    .filter((id) => !owned.has(id) && config.weights[id] > 0)
    .map((id) => ({ id, weight: config.weights[id] }));
  const rng = createPrng(relicSeed(state.seed, day));
  const choices: RelicId[] = [];
  while (choices.length < config.choices && pool.length > 0) {
    const total = pool.reduce((n, p) => n + p.weight, 0);
    let roll = rng.nextInt(total);
    const index = pool.findIndex((p) => (roll -= p.weight) < 0);
    choices.push(pool[index]!.id);
    pool.splice(index, 1);
  }
  return choices;
}

/** レリックの候補が出ていて、まだ選んでいないか */
export function isRelicPending(state: RunState): boolean {
  return (state.relicChoice?.choices.length ?? 0) > 0;
}

export function hasRelic(state: RunState, id: RelicId): boolean {
  return state.relics?.includes(id) ?? false;
}

/** 候補から1つ選ぶ */
export function pickRelic(
  state: RunState,
  index: number,
  regenerateShop: (state: RunState) => RunState,
): RunActionResult {
  if (state.phase !== 'building') return { ok: false, error: 'notBuilding' };
  const id = state.relicChoice?.choices[index];
  if (!id) return { ok: false, error: 'noRelicToPick' };
  const next: RunState = { ...state, relics: [...(state.relics ?? []), id], relicChoice: null };
  // 選ぶまで買い物はできないので、品揃えを選んだ後の価格・枠数で並べ直しても有利・不利は出ない
  return { ok: true, state: regenerateShop(next) };
}

// -----------------------------------------------------------------------------
// 効果
// -----------------------------------------------------------------------------

/** ルールに重ねる（基本 → メタ進行 → レリック → ボス修正 の順） */
export function applyRelicRules(
  rules: RuleSet,
  relics: readonly RelicId[],
  p: RelicParams,
): RuleSet {
  if (relics.length === 0) return rules;
  const has = (id: RelicId) => relics.includes(id);
  const params = { ...rules.params };
  const floorParams = { ...rules.floorParams };
  const maxActivations = { ...rules.maxActivations };
  let { switchSignalValue, goldenMultiplier } = rules;

  if (has('spareSwitch')) switchSignalValue += p.spareSwitchAdd;
  if (has('gearGloves')) params.gearMultiplier += p.gearAdd;
  if (has('rewoundCoil')) params.coilPerNeighbor += p.coilAdd;
  if (has('doubleCheck')) params.inspectorMultiplier += p.inspectorAdd;
  if (has('chainPulse'))
    params.chainMeterStep = Math.max(1, params.chainMeterStep - p.chainMeterStepDelta);
  if (has('goldLeaf') && goldenMultiplier !== undefined) goldenMultiplier += p.goldenAdd;
  // ポンコツロボの最低倍率を ×1 にする（÷ 割る数 が 1 以上になる歩数）
  if (has('junkbotHunch')) {
    params.junkbotMinSteps = Math.min(
      params.junkbotMaxSteps,
      Math.max(params.junkbotMinSteps, params.junkbotStepDivisor),
    );
  }
  if (has('polishedFloor')) {
    floorParams.doubleMultiplier = Math.max(
      floorParams.doubleMultiplier,
      p.polishedDoubleMultiplier,
    );
  }
  if (has('piggyHabit')) params.piggyBankIncome += p.piggyAdd;
  for (const id of PART_IDS) {
    const limit = maxActivations[id];
    // 上限なし（null）・信号に反応しない（0）のパーツはそのまま
    if (limit === null || limit === undefined || limit === 0) continue;
    let next = limit;
    if (has('spareOil')) next += p.spareOilAdd;
    if (has('afterglow') && id === 'barrel') next += p.afterglowAdd;
    maxActivations[id] = next;
  }

  return {
    ...rules,
    switchSignalValue,
    params,
    floorParams,
    maxActivations,
    ...(goldenMultiplier !== undefined ? { goldenMultiplier } : {}),
  };
}

/** 経済設定に重ねる（割引クーポン・目利き） */
export function applyRelicEconomy(
  economy: EconomyConfig,
  relics: readonly RelicId[],
  p: RelicParams,
): EconomyConfig {
  if (relics.length === 0) return economy;
  let next = economy;
  if (relics.includes('coupon')) {
    const prices = { ...next.prices };
    for (const id of PART_IDS) {
      if (prices[id] > 0) prices[id] = Math.max(1, prices[id] - p.couponDiscount);
    }
    next = { ...next, prices };
  }
  if (relics.includes('connoisseur')) {
    next = { ...next, offersPerShift: next.offersPerShift + p.connoisseurOffers };
  }
  return next;
}

/** シフトの設定に重ねる（夜勤手当） */
export function applyRelicShift(
  spec: ShiftSpec,
  relics: readonly RelicId[],
  p: RelicParams,
): ShiftSpec {
  if (spec.kind === 'boss' && relics.includes('nightPay')) {
    return { ...spec, clearReward: spec.clearReward + p.nightPayReward };
  }
  return spec;
}

/** ボーナス床の枚数に足す分（床職人） */
export function relicBonusFloorAdd(state: RunState): number {
  const p = state.config.relics?.params;
  return p && hasRelic(state, 'floorCraftsman') ? p.floorCraftsmanAdd : 0;
}
