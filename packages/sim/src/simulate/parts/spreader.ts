/**
 * 散布機（分岐系）: 前・左・右の3方向へ、値に redirectAdd を足して送る
 */
import { dir4ToDir8, rotateCcw, rotateCw } from '../../core/direction';
import { scoreAdd, scoreOf } from '../../core/score';
import type { PartBehavior } from './types';

export const spreaderBehavior: PartBehavior = {
  react: ({ part, value: input, rules }) => {
    // 向きを変えるパーツは、送る信号それぞれの値に redirectAdd を足す（1つでも効くように）
    const value = scoreAdd(input, scoreOf(rules.params.redirectAdd));
    return {
      emits: [
        { dir: dir4ToDir8(part.dir), value }, // 前
        { dir: dir4ToDir8(rotateCcw(part.dir)), value }, // 左
        { dir: dir4ToDir8(rotateCw(part.dir)), value }, // 右
      ],
    };
  },
};
