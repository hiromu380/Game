/**
 * コピー機（分岐系）: 自身の向きへ同じ値を2連射する（2発目は copierDelay tick 遅れ）
 *
 * 同じ経路に2本流すので、先にあるパーツが2回発動できる（コンベア・回転台など）と効果が大きい。
 * 1 tick ずれるため、合流炉で合わせるには経路の長さの調整が必要になる。
 */
import { dir4ToDir8 } from '../../core/direction';
import type { PartBehavior } from './types';

export const copierBehavior: PartBehavior = {
  react: ({ part, value, rules }) => ({
    emits: [
      { dir: dir4ToDir8(part.dir), value },
      { dir: dir4ToDir8(part.dir), value, delay: rules.params.copierDelay },
    ],
  }),
};
