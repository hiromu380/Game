/**
 * 蓄電池（倍率系）: 1回目に受けた値は溜めるだけで送らない。2回目に受けたとき、
 * （溜めた値 ＋ 受けた値）× batteryMultiplier を自身の向きへ送って空に戻る
 *
 * 合流炉は「同じ tick の信号」を合わせるが、蓄電池は「別々の tick の信号」を合わせる。
 * コピー機の2連射や、回り道で戻ってきた信号を受けると効果が出る。1本しか来なければ何も送らない。
 * 溜めている値はシミュレーション中だけの状態（Reaction.nextStored）。
 */
import { dir4ToDir8 } from '../../core/direction';
import { SCORE_ZERO, scoreAdd, scoreMul } from '../../core/score';
import type { PartBehavior } from './types';

export const batteryBehavior: PartBehavior = {
  react: ({ part, value, rules, state, stored }) => {
    // state: 0 = 空（次は溜める） / 1 = 溜めている（次は送る）
    if (state === 0) return { nextState: 1, nextStored: value };
    return {
      emits: [
        {
          dir: dir4ToDir8(part.dir),
          value: scoreMul(scoreAdd(stored, value), rules.params.batteryMultiplier),
        },
      ],
      nextState: 0,
      nextStored: SCORE_ZERO,
    };
  },
};
