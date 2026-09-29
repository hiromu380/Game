/**
 * 床タイルの効果量（床タイルの挙動は floor/tiles/ に1種類＝1ファイル）と、シフト開始時のボーナス床
 */
import type { Balance } from './types';

export const FLOOR_PARAMS: Balance['floorParams'] = {
  doubleMultiplier: 2,
  addAmount: 3,
  tripleMultiplier: 3,
};

/** シフト開始時のボーナス床（仮の数値）: 1〜2枚、×2床か加算床 */
export const BONUS_FLOORS: Balance['bonusFloors'] = {
  countWeights: [0, 70, 30],
  tileWeights: [
    { tile: 'double', weight: 65 },
    { tile: 'add', weight: 35 },
  ],
};
