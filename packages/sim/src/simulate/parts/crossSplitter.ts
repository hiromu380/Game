/**
 * 十字分岐器（分岐系）: 前・左・右・後ろの4方向へ、値を crossSplitterDivisor で割って（切り捨て）送る
 *
 * 本数は4倍になるが、1本あたりの値は小さくなる。後ろへの1本は入ってきた側へ戻る。
 */
import { dir4ToDir8, rotateCcw, rotateCw } from '../../core/direction';
import { scoreDiv } from '../../core/score';
import type { Dir4 } from '../../types';
import type { PartBehavior } from './types';

export const crossSplitterBehavior: PartBehavior = {
  react: ({ part, value, rules }) => {
    const v = scoreDiv(value, rules.params.crossSplitterDivisor);
    const back = ((part.dir + 2) % 4) as Dir4;
    return {
      emits: [part.dir, rotateCcw(part.dir), rotateCw(part.dir), back].map((d) => ({
        dir: dir4ToDir8(d),
        value: v,
      })),
    };
  },
};
