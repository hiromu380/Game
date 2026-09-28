/**
 * 連鎖メーター（倍率系）: 値に（その時点の連鎖数 ÷ chainMeterStep ＋ 1、切り捨て）を掛けて送る
 *
 * 長い連鎖の終盤に置くほど強い。「連鎖を伸ばす」こと自体に価値を持たせるためのパーツ。
 */
import { dir4ToDir8 } from '../../core/direction';
import { scoreMul } from '../../core/score';
import type { RuleSet } from '../../types';
import type { PartBehavior } from './types';

export function getChainMeterMultiplier(chainCount: number, rules: RuleSet): number {
  return Math.floor(chainCount / rules.params.chainMeterStep) + 1;
}

export const chainMeterBehavior: PartBehavior = {
  react: ({ part, value, chainCount, rules }) => ({
    emits: [
      {
        dir: dir4ToDir8(part.dir),
        value: scoreMul(value, getChainMeterMultiplier(chainCount, rules)),
      },
    ],
  }),
};
