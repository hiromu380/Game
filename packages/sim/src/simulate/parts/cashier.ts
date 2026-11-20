/**
 * 換金機（経済系）: 受けた信号を消して、値の桁数 × cashierPerDigit だけ次シフトの予算を増やす
 *
 * 出荷量にはならない。1回のシミュレーションで生める予算の上限（maxIncomePerSim）は貯金箱と共通。
 */
import { scoreToString } from '../../core/score';
import type { PartBehavior } from './types';

export const cashierBehavior: PartBehavior = {
  react: ({ value, rules }) => {
    const digits = value > 0n ? scoreToString(value).length : 0;
    return digits > 0 ? { income: digits * rules.params.cashierPerDigit } : {};
  },
};
