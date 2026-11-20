/**
 * 合流炉（倍率系）: 同じ tick に入った信号の値を掛け合わせ、tick の終わりに1本にして自身の向きへ送る
 *
 * 分岐器・散布機で増やした信号を、別々の経路で育ててから同じ tick に集めると値が跳ねる。
 * 導入前のランは足し算（rules.mergeMode が無い = sum）。
 * 発動回数は「信号を受けた tick ごとに1回」と数える（simulate.ts の collect 処理）。
 */
import { dir4ToDir8 } from '../../core/direction';
import { SCORE_ZERO, scoreAdd, scoreMulScore, scoreOf, type Score } from '../../core/score';
import type { RuleSet } from '../../types';
import type { PartBehavior } from './types';

/** 同じ tick に取り込んだ値を1つにまとめる（床の効果はまとめた値に1回だけ適用する） */
export function combineMerged(values: Score[], rules: RuleSet): Score {
  return rules.mergeMode === 'product'
    ? values.reduce(scoreMulScore, scoreOf(1))
    : values.reduce(scoreAdd, SCORE_ZERO);
}

export const mergerBehavior: PartBehavior = {
  react: null,
  collect: ({ part, values, rules }) => ({
    emits: [{ dir: dir4ToDir8(part.dir), value: combineMerged(values, rules) }],
  }),
};
