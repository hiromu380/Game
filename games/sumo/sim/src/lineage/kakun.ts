/**
 * 家訓（一門のすべての代に効く。代替わりのときに1つ書き加える）
 */
import type { GrowthContext } from '../career/growth';
import type { KakunId, Style } from '../model/types';

export const KAKUN_IDS: readonly KakunId[] = [
  'tachiai',
  'yotsuFirst',
  'craft',
  'chanko',
  'restDay',
  'thrift',
];

export const KAKUN = {
  /** 型の稽古の倍率 */
  styleBoost: 1.1,
  /** ちゃんこ: 体づくりの増え方（kg）と食費の増え方 */
  chankoKg: 1,
  chankoFoodCost: 1.1,
  /** 休養日: 疲労の回復の上乗せ */
  restRecovery: 5,
  /** 倹約: 固定費の倍率 */
  thriftFixed: 0.85,
};

const STYLE_KAKUN: Partial<Record<KakunId, Style>> = {
  tachiai: 'oshi',
  yotsuFirst: 'yotsu',
  craft: 'waza',
};

export function applyKakun(base: GrowthContext, kakun: readonly KakunId[]): GrowthContext {
  const styleMultiplier = { ...base.styleMultiplier };
  for (const k of kakun) {
    const s = STYLE_KAKUN[k];
    if (s) styleMultiplier[s] *= KAKUN.styleBoost;
  }
  return {
    ...base,
    styleMultiplier,
    extraBodyKg: base.extraBodyKg + (kakun.includes('chanko') ? KAKUN.chankoKg : 0),
    extraRecovery: base.extraRecovery + (kakun.includes('restDay') ? KAKUN.restRecovery : 0),
  };
}
