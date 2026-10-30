/**
 * シード付き疑似乱数（mulberry32）
 *
 * シミュレーションで使う唯一の乱数源。Math.random() は使わない。
 * 32bit 整数演算だけでできているので、どの環境でも同じ列を返す。
 */

export interface Prng {
  /** 0 以上 2^32 未満の整数 */
  nextUint32(): number;
  /** 0 以上 max 未満の整数 */
  nextInt(max: number): number;
  /** min 以上 max 以下の整数 */
  range(min: number, max: number): number;
  /** 確率 p（0〜1）で true */
  chance(p: number): boolean;
  /** 配列から1つ選ぶ */
  pick<T>(items: readonly T[]): T;
}

const TWO_32 = 4294967296;

export function createPrng(seed: number): Prng {
  let state = seed >>> 0;
  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const nextInt = (max: number): number => (max <= 1 ? 0 : nextUint32() % max);
  return {
    nextUint32,
    nextInt,
    range: (min, max) => min + nextInt(max - min + 1),
    // 掛け算と比較だけなので、どの環境でも同じ結果になる
    chance: (p) => nextUint32() < p * TWO_32,
    pick: (items) => items[nextInt(items.length)]!,
  };
}

/** 用途ごとの子シード（例: ゲームのシード → 何場所目の取組） */
export function deriveSeed(seed: number, ...labels: number[]): number {
  let h = seed >>> 0;
  for (const label of labels) {
    h = Math.imul(h ^ (label >>> 0), 0x9e3779b1) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
  }
  return createPrng(h).nextUint32();
}

/** 乱数の用途（deriveSeed の最初のラベル） */
export const SEED = {
  world: 1,
  bout: 2,
  growth: 3,
  injury: 4,
  recruit: 5,
  retire: 6,
  names: 7,
  toshiyori: 8,
  condition: 9,
  kakun: 10,
  lineage: 11,
  happening: 12,
  rival: 13,
  office: 14,
  koenkai: 15,
} as const;
