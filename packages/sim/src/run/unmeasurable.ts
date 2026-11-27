/**
 * 計測不能: 1シフトの出荷量が balance の桁数以上なら、画面では数字の代わりに「計測不能」と出す。
 * 表示だけの判定で、内部の値・ランキングの並びは正確な値のまま
 */
import { BALANCE } from '../balance';
import { scoreToString, type Score } from '../core/score';

export function isUnmeasurable(
  score: Score | string,
  digits: number = BALANCE.unmeasurable.digits,
): boolean {
  const text = typeof score === 'string' ? score : scoreToString(score);
  return text.replace(/^-/, '').length >= digits;
}
