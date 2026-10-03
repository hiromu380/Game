/**
 * 床を湧かせる位置・種類の抽選（決定論）
 *
 * 位置は「シードで全マスの並び順（順列）を先に決め、先頭から順に条件に合う最初のマス」を選ぶ。
 * 並び順を先に固定しておくので、パーツを動かして空きマスを変えても、良い位置を狙って引き直すことはできない。
 */
import type { Prng } from '../core/prng';
import type { FloorTileId } from './types';

/** 0〜count-1 の並び順（Fisher–Yates） */
export function cellPermutation(rng: Prng, count: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = count - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

/** 重みつきで1つ選ぶ（重みの合計が 0 なら null） */
export function pickWeighted<T>(rng: Prng, items: { value: T; weight: number }[]): T | null {
  const total = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  if (total <= 0) return null;
  let roll = rng.nextInt(total);
  for (const item of items) {
    roll -= Math.max(0, item.weight);
    if (roll < 0) return item.value;
  }
  return null;
}

/** 床の種類を重みつきで1つ選ぶ */
export function pickTile(
  rng: Prng,
  weights: { tile: FloorTileId; weight: number }[],
): FloorTileId | null {
  return pickWeighted(
    rng,
    weights.map((w) => ({ value: w.tile, weight: w.weight })),
  );
}
