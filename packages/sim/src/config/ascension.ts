/**
 * 残業レベル: RunConfig に重ねる層（ラン開始時に1回だけ。週替わりでは使わない）
 *
 * Lv L は balance の levels[0]〜levels[L-1] をすべて重ねる。ノルマは整数で計算する（切り上げ）
 */
import type { AscensionEffect, Balance } from '../balance/types';
import { PART_IDS } from '../types';
import type { RunConfig } from './runConfig';

/** 選べる最大のレベル */
export function maxAscension(balance: Pick<Balance, 'ascension'>): number {
  return balance.ascension.levels.length;
}

/** Lv level までの条件をまとめる */
export function ascensionEffects(
  level: number,
  balance: Pick<Balance, 'ascension'>,
): AscensionEffect[] {
  return balance.ascension.levels.slice(0, Math.max(0, Math.min(level, maxAscension(balance))));
}

/** 残業レベルを RunConfig に重ねる（Lv0 はそのまま） */
export function applyAscension(
  config: RunConfig,
  level: number,
  balance: Pick<Balance, 'ascension'>,
): RunConfig {
  const effects = ascensionEffects(level, balance);
  if (effects.length === 0) return config;
  const sum = (key: keyof AscensionEffect) => effects.reduce((n, e) => n + (e[key] ?? 0), 0);

  // ノルマ: 掛け算を重ねて、最後に1回だけ切り上げる
  let num = 1n;
  let den = 1n;
  for (const e of effects) {
    if (e.quotaPercent === undefined) continue;
    num *= BigInt(e.quotaPercent);
    den *= 100n;
  }
  const quota = (q: number) => Number((BigInt(q) * num + den - 1n) / den);
  const budget = (b: number) => Math.max(0, b + sum('budgetDelta'));

  const priceDelta = sum('priceDelta');
  const prices = { ...config.economy.prices };
  for (const id of PART_IDS) {
    if (prices[id] > 0) prices[id] = Math.max(1, prices[id] + priceDelta);
  }

  // ボーナス床の枚数: n 枚の重みを max(0, n + delta) 枚へ寄せる
  const floorDelta = sum('bonusFloorDelta');
  const bonusFloors = config.bonusFloors && {
    ...config.bonusFloors,
    countWeights: config.bonusFloors.countWeights.reduce<number[]>((acc, weight, n) => {
      const to = Math.max(0, n + floorDelta);
      while (acc.length <= to) acc.push(0);
      acc[to]! += weight;
      return acc;
    }, []),
  };

  return {
    ...config,
    ascension: effects.length,
    shifts: config.shifts.map((s) => ({ ...s, quota: quota(s.quota), budget: budget(s.budget) })),
    overtime: { ...config.overtime, budget: budget(config.overtime.budget) },
    economy: {
      ...config.economy,
      prices,
      reroll: {
        ...config.economy.reroll,
        costStep: config.economy.reroll.costStep + sum('rerollStepDelta'),
      },
    },
    ...(bonusFloors ? { bonusFloors } : {}),
    ...(config.relics
      ? {
          relics: {
            ...config.relics,
            choices: Math.max(1, config.relics.choices + sum('relicChoicesDelta')),
          },
        }
      : {}),
    ...(config.dayEvents
      ? {
          dayEvents: {
            ...config.dayEvents,
            choices: Math.max(1, config.dayEvents.choices + sum('eventChoicesDelta')),
          },
        }
      : {}),
  };
}
