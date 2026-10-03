/**
 * 床タイルの効果量（床タイルの挙動は floor/tiles/ に1種類＝1ファイル）と、シフト開始時のボーナス床・ランダム配置権
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

/** ランダム配置権（仮の数値）: ×2床 60・加算床 35・×3床 5（×3床は3日目から） */
export const FLOOR_PERMIT: Balance['floorPermit'] = {
  price: 4,
  offerChancePercent: 25,
  maxHeld: 3,
  tileWeights: [
    { tile: 'double', weight: 60 },
    { tile: 'add', weight: 35 },
    { tile: 'triple', weight: 5, fromDay: 2 },
  ],
  inDaily: true,
};
