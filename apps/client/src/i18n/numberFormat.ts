/**
 * 大きな数の表記
 *
 * - 12,345 → 12.3K / 1,234,567 → 1.23M … Dc まで。それを超えたら指数表記（1.23e36）
 * - 日本語も英語と同じ K・M・B 表記にする（ユーザー判断: 万・億より桁の伸びが直感的に伝わるため）
 * - 「そのまま（桁区切り）」と「単位つき」を切り替える桁数は NUMBER_FORMAT_CONFIG で調整する
 *
 * スコアは bigint を包んだ Score 型なので、浮動小数点に変換せず文字列の桁操作で表記を作る。
 * lang 引数は、将来言語ごとに表記を変えたくなったとき用に残している。
 */
import { scoreFromString, type Score } from '@chain-factory/sim';

export type NumberLang = 'ja' | 'en';

export const NUMBER_FORMAT_CONFIG = {
  /** この桁数までは桁区切りでそのまま表示する（HUD・結果画面など） */
  fullMaxDigits: 12,
  /** 単位つき表記の有効数字 */
  significantDigits: 3,
  /** 単位（3桁ごと） */
  units: ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'],
} as const;

/** 数字の文字列を3桁区切りにする */
function groupDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 仮数部を作る: digits の先頭から intLen 桁を整数部、残りを小数部として、有効数字 sig 桁に切り捨てる
 * 例: ('123456', 2, 3) → '12.3'
 */
function mantissa(digits: string, intLen: number, sig: number): string {
  const int = digits.slice(0, intLen);
  const decimals = Math.max(0, sig - intLen);
  const frac = digits.slice(intLen, intLen + decimals).replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

/** 指数表記（例: 1.23e52） */
function scientific(digits: string, sig: number): string {
  return `${mantissa(digits, 1, sig)}e${digits.length - 1}`;
}

/**
 * 短い表記（信号の上・ポップアップなど狭い場所用）
 * 4桁以下はそのまま、それ以上は単位つき
 */
export function formatCompactNumber(value: Score | string, _lang: NumberLang): string {
  const text = (typeof value === 'string' ? scoreFromString(value) : value).toString();
  const negative = text.startsWith('-');
  const digits = negative ? text.slice(1) : text;
  const sign = negative ? '-' : '';
  const { significantDigits: sig, units } = NUMBER_FORMAT_CONFIG;

  if (digits.length <= 4) return sign + groupDigits(digits);
  // 3桁ごとに単位が上がる（K = 10^3）
  const unitIndex = Math.floor((digits.length - 1) / 3) - 1;
  if (unitIndex >= units.length) return sign + scientific(digits, sig);
  const intLen = digits.length - (unitIndex + 1) * 3;
  return sign + mantissa(digits, intLen, sig) + units[unitIndex];
}

/**
 * 通常の表記（HUD・結果画面など）
 * fullMaxDigits 桁までは桁区切りでそのまま、それを超えたら単位つき
 */
export function formatScoreNumber(value: Score | string, lang: NumberLang): string {
  const text = (typeof value === 'string' ? scoreFromString(value) : value).toString();
  const digits = text.replace('-', '');
  if (digits.length <= NUMBER_FORMAT_CONFIG.fullMaxDigits) {
    return (text.startsWith('-') ? '-' : '') + groupDigits(digits);
  }
  return formatCompactNumber(value, lang);
}
