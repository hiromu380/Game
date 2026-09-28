/**
 * 数値の表示用フォーマット
 */
import { scoreFromString, type Score } from '@chain-factory/sim';

/** スコアを桁区切りで表示（例: 1,234,567） */
export function formatScore(score: Score | string): string {
  const value = typeof score === 'string' ? scoreFromString(score) : score;
  return value.toLocaleString('en-US');
}

/** 信号の上に出す短い表記（例: 12, 3.4K, 5.6M, 1.2e12） */
export function formatCompact(score: Score): string {
  const text = score.toString();
  if (text.length <= 4) return text;
  const units = [
    { digits: 7, suffix: 'K', div: 3 },
    { digits: 10, suffix: 'M', div: 6 },
    { digits: 13, suffix: 'B', div: 9 },
  ];
  for (const unit of units) {
    if (text.length < unit.digits) {
      const intLen = text.length - unit.div;
      return `${text.slice(0, intLen)}${intLen < 3 ? '.' + text[intLen] : ''}${unit.suffix}`;
    }
  }
  return `${text[0]}.${text[1]}e${text.length - 1}`;
}
