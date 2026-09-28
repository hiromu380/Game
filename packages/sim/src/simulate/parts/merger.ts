/**
 * 合流炉（倍率系）: 同じ tick に入った信号をすべて合算し、tick の終わりに1本にして自身の向きへ送る
 *
 * 分岐器・散布機で増やした信号を、経路の長さを揃えて同じ tick に集めると値が跳ねる。
 * 発動回数は「信号を受けた tick ごとに1回」と数える（simulate.ts の collect 処理）。
 */
import { dir4ToDir8 } from '../../core/direction';
import { SCORE_ZERO, scoreAdd } from '../../core/score';
import type { PartBehavior } from './types';

export const mergerBehavior: PartBehavior = {
  react: null,
  collect: ({ part, values }) => ({
    emits: [{ dir: dir4ToDir8(part.dir), value: values.reduce(scoreAdd, SCORE_ZERO) }],
  }),
};
