/**
 * 方向まわりのヘルパー
 */
import type { Dir4, Dir8 } from '../types';

/** 8方向それぞれの移動量（y は下向きが正） */
const DIR8_DELTAS: readonly (readonly [number, number])[] = [
  [0, -1], // 0: 上
  [1, -1], // 1: 右上
  [1, 0], // 2: 右
  [1, 1], // 3: 右下
  [0, 1], // 4: 下
  [-1, 1], // 5: 左下
  [-1, 0], // 6: 左
  [-1, -1], // 7: 左上
];

export const ALL_DIR8: readonly Dir8[] = [0, 1, 2, 3, 4, 5, 6, 7];
export const ALL_DIR4: readonly Dir4[] = [0, 1, 2, 3];

/** 8方向の移動量 [dx, dy] */
export function dir8Delta(dir: Dir8): readonly [number, number] {
  return DIR8_DELTAS[dir]!;
}

/** パーツの向き（4方向）を信号の方向（8方向）へ変換 */
export function dir4ToDir8(dir: Dir4): Dir8 {
  return (dir * 2) as Dir8;
}

/** 時計回りに90度回転 */
export function rotateCw(dir: Dir4): Dir4 {
  return ((dir + 1) % 4) as Dir4;
}

/** 反時計回りに90度回転 */
export function rotateCcw(dir: Dir4): Dir4 {
  return ((dir + 3) % 4) as Dir4;
}
