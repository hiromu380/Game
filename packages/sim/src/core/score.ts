/**
 * スコア（出荷量）型
 *
 * 連鎖で桁が大きく跳ねる前提のため、number ではなく専用型で包む。
 * 現在の実装は bigint（整数・環境差なし）。将来ビッグナンバー実装へ差し替える場合は
 * このファイルだけを書き換えればよいよう、スコア演算は必ずここの関数を経由すること。
 */

declare const scoreBrand: unique symbol;

/** スコア値（中身に直接触らず、下の関数で扱う） */
export type Score = bigint & { readonly [scoreBrand]: true };

/** 整数からスコアを作る */
export function scoreOf(n: number | bigint): Score {
  if (typeof n === 'number' && !Number.isInteger(n)) {
    throw new Error(`Score must be an integer: ${n}`);
  }
  return BigInt(n) as Score;
}

export const SCORE_ZERO = scoreOf(0);

export function scoreAdd(a: Score, b: Score): Score {
  return (a + b) as Score;
}

/** スコア × 整数倍率 */
export function scoreMul(a: Score, factor: number): Score {
  return (a * BigInt(factor)) as Score;
}

/** 比較: a < b なら負、等しければ 0、a > b なら正 */
export function scoreCompare(a: Score, b: Score): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function scoreMax(a: Score, b: Score): Score {
  return a >= b ? a : b;
}

/** 保存・通信用の文字列へ変換（JSON は bigint を扱えないため） */
export function scoreToString(s: Score): string {
  return s.toString();
}

/** scoreToString の逆変換 */
export function scoreFromString(str: string): Score {
  if (!/^-?\d+$/.test(str)) throw new Error(`Invalid score string: ${str}`);
  return BigInt(str) as Score;
}
