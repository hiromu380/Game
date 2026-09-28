/**
 * シード付き疑似乱数（mulberry32）
 *
 * シミュレーション・ショップ生成で使う唯一の乱数源。Math.random() は使わない。
 * 32bit 整数演算のみで構成しているため、どの環境でも同じ列を返す。
 */

export interface Prng {
  /** 0 以上 2^32 未満の整数を返す */
  nextUint32(): number;
  /** 0 以上 max 未満の整数を返す */
  nextInt(max: number): number;
}

export function createPrng(seed: number): Prng {
  let state = seed >>> 0;

  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };

  return {
    nextUint32,
    // 剰余による偏りは max が小さいため無視できる（決定論性には影響しない）
    nextInt: (max) => nextUint32() % max,
  };
}

/**
 * 親シードとラベル（整数）から子シードを作る。
 * 例: ランのシード → シフトごとのシミュレーション用シード / ショップ用シード
 */
export function deriveSeed(seed: number, ...labels: number[]): number {
  let h = seed >>> 0;
  for (const label of labels) {
    h = Math.imul(h ^ (label >>> 0), 0x9e3779b1) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
  }
  return createPrng(h).nextUint32();
}

/**
 * 文字列から32bitのシードを作る（FNV-1a）。
 * デイリーの ID（例: '2026-09-28'）から、全員共通のランシードを作るのに使う
 */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
