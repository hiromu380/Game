/**
 * 大きな数の表記（言語ごと）
 *
 * - 日本語: 12,345 → 1.23万 / 123,456,789 → 1.23億 … 極 まで。それを超えたら指数表記（1.23e52）
 * - 英語:   12,345 → 12.3K / 1,234,567 → 1.23M … Dc まで。それを超えたら指数表記
 * - 「そのまま（桁区切り）」と「単位つき」を切り替える桁数は NUMBER_FORMAT_CONFIG で調整する
 *
 * スコアは bigint を包んだ Score 型なので、浮動小数点に変換せず文字列の桁操作で表記を作る。
 */
import { scoreFromString, type Score } from '@chain-factory/sim';

export type NumberLang = 'ja' | 'en';

export const NUMBER_FORMAT_CONFIG = {
  /** この桁数までは桁区切りでそのまま表示する（HUD・結果画面など） */
  fullMaxDigits: 12,
  /** 単位つき表記の有効数字 */
  significantDigits: 3,
  /** 日本語の単位（4桁ごと） */
  jaUnits: ['万', '億', '兆', '京', '垓', '秭', '穣', '溝', '澗', '正', '載', '極'],
  /** 英語の単位（3桁ごと） */
  enUnits: ['K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'],
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
export function formatCompactNumber(value: Score | string, lang: NumberLang): string {
  const text = (typeof value === 'string' ? scoreFromString(value) : value).toString();
  const negative = text.startsWith('-');
  const digits = negative ? text.slice(1) : text;
  const sign = negative ? '-' : '';
  const { significantDigits: sig, jaUnits, enUnits } = NUMBER_FORMAT_CONFIG;

  if (lang === 'ja') {
    if (digits.length <= 4) return sign + digits;
    // 4桁ごとに単位が上がる（万 = 10^4）
    const unitIndex = Math.floor((digits.length - 1) / 4) - 1;
    if (unitIndex >= jaUnits.length) return sign + scientific(digits, sig);
    const intLen = digits.length - (unitIndex + 1) * 4;
    return sign + mantissa(digits, intLen, sig) + jaUnits[unitIndex];
  }

  if (digits.length <= 4) return sign + groupDigits(digits);
  // 3桁ごとに単位が上がる（K = 10^3）
  const unitIndex = Math.floor((digits.length - 1) / 3) - 1;
  if (unitIndex >= enUnits.length) return sign + scientific(digits, sig);
  const intLen = digits.length - (unitIndex + 1) * 3;
  return sign + mantissa(digits, intLen, sig) + enUnits[unitIndex];
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
