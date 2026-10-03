/**
 * 床タイルの効果量（床タイルの挙動は floor/tiles/ に1種類＝1ファイル）
 */
import type { Balance } from './types';

export const FLOOR_PARAMS: Balance['floorParams'] = {
  doubleMultiplier: 2,
  addAmount: 3,
  tripleMultiplier: 3,
};
