/**
 * 分岐器: 受けた信号を、自身の向きから見て左右2方向へ同じ値で送る
 */
import { dir4ToDir8, rotateCcw, rotateCw } from '../../core/direction';
import type { PartBehavior } from './types';

export const splitterBehavior: PartBehavior = {
  react: ({ part, value }) => ({
    emits: [
      { dir: dir4ToDir8(rotateCcw(part.dir)), value }, // 左
      { dir: dir4ToDir8(rotateCw(part.dir)), value }, // 右
    ],
  }),
};
