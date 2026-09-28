/**
 * 出荷口: 受けた信号の値を出荷量（スコア）に加算する。信号はここで終わる。
 */
import type { PartBehavior } from './types';

export const dockBehavior: PartBehavior = {
  react: ({ value }) => ({ ship: value }),
};
