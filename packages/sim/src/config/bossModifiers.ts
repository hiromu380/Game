/**
 * ボスシフトの修正ルール
 *
 * 1ルール = RuleSet / 経済設定を書き換える純粋関数。効果量は balance/ の boss に置く。
 * 新しいルールを足すときは BossModifierId（balance/）とここの一覧に追加する。
 */
import type { Balance, BossModifierId } from '../balance';
import { emptyFloor, setFloorCell } from '../floor/layer';
import type { FloorLayer } from '../floor/types';
import type { RuleSet } from '../types';
import type { BossPlanEntry, EconomyConfig, RunConfig } from './runConfig';

type BossParams = Balance['boss'];

interface BossModifier {
  applyRules?: (rules: RuleSet, entry: BossPlanEntry, params: BossParams) => RuleSet;
  applyEconomy?: (economy: EconomyConfig, params: BossParams) => EconomyConfig;
}

export const BOSS_MODIFIERS: Record<BossModifierId, BossModifier> = {
  /** 油切れ: コンベアの発動回数が減る */
  lowOil: {
    applyRules: (rules, _entry, params) => {
      const current = rules.maxActivations.conveyor;
      const next = current === null ? null : Math.max(0, current + params.lowOilConveyorDelta);
      return { ...rules, maxActivations: { ...rules.maxActivations, conveyor: next } };
    },
  },
  /** 床の補修工事: 一部のマスが使用不可（ルールは変えず、そのシフトの床に使用不可を重ねる。getShiftFloor） */
  repairWork: {},
  /** 出荷検査強化: 出荷口の加算が減る */
  strictInspection: {
    applyRules: (rules, _entry, params) => ({
      ...rules,
      dockDivisor: rules.dockDivisor * params.strictInspectionDivisor,
    }),
  },
  /** 短縮営業: tick 上限が短くなる */
  shortShift: {
    applyRules: (rules, _entry, params) => ({
      ...rules,
      tickLimit: Math.min(rules.tickLimit, params.shortShiftTickLimit),
    }),
  },
  /** 部品不足: ショップの品数が減り、リロールできない */
  partShortage: {
    applyEconomy: (economy, params) => ({
      ...economy,
      offersPerShift: Math.max(1, economy.offersPerShift + params.partShortageOffersDelta),
      reroll: { ...economy.reroll, enabled: false },
    }),
  },
};

/** そのシフトで使う RuleSet（ボス修正込み） */
export function getShiftRules(config: RunConfig, shiftIndex: number): RuleSet {
  // ラン全体の修正（デイリーの特殊ルール）→ そのシフトのボス修正 の順に重ねる
  let rules = config.rules;
  for (const entry of [config.globalModifier ?? null, config.bossPlan[shiftIndex] ?? null]) {
    if (!entry) continue;
    rules = BOSS_MODIFIERS[entry.id].applyRules?.(rules, entry, config.bossParams) ?? rules;
  }
  return rules;
}

/** そのシフトで使う経済設定（ボス修正込み） */
export function getShiftEconomy(config: RunConfig, shiftIndex: number): EconomyConfig {
  let economy = config.economy;
  for (const entry of [config.globalModifier ?? null, config.bossPlan[shiftIndex] ?? null]) {
    if (!entry) continue;
    economy = BOSS_MODIFIERS[entry.id].applyEconomy?.(economy, config.bossParams) ?? economy;
  }
  return economy;
}

/**
 * そのシフトの床 = その日のステージ ＋ ラン全体の修正・そのシフトのボス修正の使用不可マス
 * （シフト開始時のボーナス床・今日の出来事の床は、ランの状態から run/floor.ts で重ねる）
 */
export function getShiftFloor(config: RunConfig, shiftIndex: number): FloorLayer {
  const day = Math.floor(shiftIndex / config.shiftsPerDay);
  let floor = config.stages?.days[day] ?? emptyFloor(config.board.width * config.board.height);
  for (const entry of [config.globalModifier ?? null, config.bossPlan[shiftIndex] ?? null]) {
    for (const cell of entry?.blockedCells ?? []) {
      floor = setFloorCell(floor, cell, { tile: 'blocked', source: 'boss' });
    }
  }
  return floor;
}
