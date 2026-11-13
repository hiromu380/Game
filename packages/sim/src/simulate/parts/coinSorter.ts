/**
 * コイン選別機（経済系）: 信号をそのまま自身の向きへ送り、受けた値が coinSorterThreshold 以上なら
 * 次シフトの予算を coinSorterIncome 増やす（未満なら増やさない）
 *
 * 貯金箱は「通せば必ず＋1」、こちらは「値を育ててから通すと＋2」。倍率パーツの後ろに置くほど得になる。
 * 床の効果は発動の前に値へ適用されるので、×2床の上に置くと届きやすい。
 * 1回のシミュレーションで生める予算の上限（rules.maxIncomePerSim）は貯金箱と共通。
 */
import { dir4ToDir8 } from '../../core/direction';
import { scoreCompare, scoreOf } from '../../core/score';
import type { PartBehavior } from './types';

export const coinSorterBehavior: PartBehavior = {
  react: ({ part, value, rules }) => {
    const emits = [{ dir: dir4ToDir8(part.dir), value }];
    const enough = scoreCompare(value, scoreOf(rules.params.coinSorterThreshold)) >= 0;
    return enough ? { emits, income: rules.params.coinSorterIncome } : { emits };
  },
};
