/**
 * ボスシフトの修正ルール
 *
 * 1ルール = RuleSet / 経済設定を書き換える純粋関数。効果量は balance.ts の boss に置く。
 * 新しいルールを足すときは BossModifierId（balance.ts）とここの一覧に追加する。
 */
import type { Balance, BossModifierId } from '../balance';
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
  /** 床の補修工事: 一部のマスが使用不可 */
  repairWork: {
    applyRules: (rules, entry) => ({
      ...rules,
      blockedCells: [...rules.blockedCells, ...entry.blockedCells],
    }),
  },
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
  const entry = config.bossPlan[shiftIndex];
  if (!entry) return config.rules;
  return (
    BOSS_MODIFIERS[entry.id].applyRules?.(config.rules, entry, config.bossParams) ?? config.rules
  );
}

/** そのシフトで使う経済設定（ボス修正込み） */
export function getShiftEconomy(config: RunConfig, shiftIndex: number): EconomyConfig {
  const entry = config.bossPlan[shiftIndex];
  if (!entry) return config.economy;
  return (
    BOSS_MODIFIERS[entry.id].applyEconomy?.(config.economy, config.bossParams) ?? config.economy
  );
}
