/**
 * 巨大なスコアを DB に保存・並べ替えるための「3列」表現
 *
 * - digits: 桁数（整数）
 * - head:   先頭15桁（整数）。15桁の最大値 999兆 は 2^53（約 9007兆）未満なので、
 *           JavaScript の number でも DB の整数型でも誤差なく扱える
 * - text:   完全な値（文字列）
 *
 * 並べ替えは digits → head の整数比較が基本。head まで同じときだけ text で決着をつける
 * （桁数が同じ数字だけの文字列なので、辞書順 = 数値の大小。照合順序の違いも出ない）。
 */
import { scoreFromString, scoreToString, type Score } from '@chain-factory/sim';

/** 先頭から取り出す桁数 */
export const SCORE_HEAD_DIGITS = 15;

export interface ScoreColumns {
  digits: number;
  head: number;
  text: string;
}

/** Score → 3列（負の値は扱わない。出荷量は 0 以上） */
export function toScoreColumns(score: Score): ScoreColumns {
  const text = scoreToString(score);
  if (text.startsWith('-')) throw new Error('Score must not be negative');
  // 0 は1桁として扱う（「0」という1文字）
  return { digits: text.length, head: Number(text.slice(0, SCORE_HEAD_DIGITS)), text };
}

/** 3列 → Score */
export function fromScoreColumns(columns: Pick<ScoreColumns, 'text'>): Score {
  return scoreFromString(columns.text);
}

/**
 * 3列どうしの比較（大きいほど正）。DB の ORDER BY と同じ順で比べ、最後に完全な値で決着をつける
 */
export function compareScoreColumns(a: ScoreColumns, b: ScoreColumns): number {
  if (a.digits !== b.digits) return a.digits - b.digits;
  if (a.head !== b.head) return a.head - b.head;
  const x = BigInt(a.text);
  const y = BigInt(b.text);
  return x === y ? 0 : x > y ? 1 : -1;
}
