/**
 * ブースター（倍率系）: 値に boosterAdd を足して自身の向きへ送る
 *
 * 序盤の小さい値の底上げ。掛け算の前に置くほど効く。
 */
import { dir4ToDir8 } from '../../core/direction';
import { scoreAdd, scoreOf } from '../../core/score';
import type { PartBehavior } from './types';

export const boosterBehavior: PartBehavior = {
  react: ({ part, value, rules }) => ({
    emits: [
      { dir: dir4ToDir8(part.dir), value: scoreAdd(value, scoreOf(rules.params.boosterAdd)) },
    ],
  }),
};
