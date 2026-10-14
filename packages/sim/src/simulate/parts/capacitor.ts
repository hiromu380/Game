/**
 * 蓄電器（倍率系）: 1回目に受けた信号は送らずに溜める。2回目に受けたとき、
 * 「溜めた値 ＋ 今の値」を capacitorMultiplier 倍して自身の向きへ送る（発動回数は2回）
 *
 * 2本目が来ないと、溜めた値は失われる。2本の信号を同じパーツへ集める組み方が要る。
 */
import { dir4ToDir8 } from '../../core/direction';
import { scoreAdd, scoreMul } from '../../core/score';
import type { PartBehavior } from './types';

export const capacitorBehavior: PartBehavior = {
  react: ({ part, value, rules, state, stored }) => {
    if (state === 0) return { nextState: 1, store: value };
    return {
      nextState: state + 1,
      store: null,
      emits: [
        {
          dir: dir4ToDir8(part.dir),
          value: scoreMul(scoreAdd(stored, value), rules.params.capacitorMultiplier),
        },
      ],
    };
  },
};
