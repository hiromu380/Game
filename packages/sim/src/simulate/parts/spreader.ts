/**
 * 散布機（分岐系）: 前・左・右の3方向へ同じ値で送る
 */
import { dir4ToDir8, rotateCcw, rotateCw } from '../../core/direction';
import type { PartBehavior } from './types';

export const spreaderBehavior: PartBehavior = {
  react: ({ part, value }) => ({
    emits: [
      { dir: dir4ToDir8(part.dir), value }, // 前
      { dir: dir4ToDir8(rotateCcw(part.dir)), value }, // 左
      { dir: dir4ToDir8(rotateCw(part.dir)), value }, // 右
    ],
  }),
};
