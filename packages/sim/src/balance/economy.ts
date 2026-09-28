/**
 * 経済: ショップの品数・リロール・売却・最初の手持ち
 */
import type { Balance } from './types';

export const ECONOMY: Balance['economy'] = {
  offersPerShift: 5,
  reroll: { baseCost: 1, costStep: 1 },
  refundPercent: 50,
  starterKit: { switch: 1, dock: 2, gear: 1 },
};
