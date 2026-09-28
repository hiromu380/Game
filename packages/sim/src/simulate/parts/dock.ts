/**
 * 出荷口: 受けた信号の値を出荷量（スコア）に加算する。信号はここで終わる。
 * ボス「出荷検査強化」では dockDivisor で割る（切り捨て）。
 */
import { scoreDiv } from '../../core/score';
import type { PartBehavior } from './types';

export const dockBehavior: PartBehavior = {
  react: ({ value, rules }) => ({ ship: scoreDiv(value, rules.dockDivisor) }),
};
