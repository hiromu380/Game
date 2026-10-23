/**
 * 経済: ショップの品数・リロール・売却・最初の手持ち・超過ボーナス
 */
import type { Balance } from './types';

export const ECONOMY: Balance['economy'] = {
  offersPerShift: 5,
  reroll: { baseCost: 1, costStep: 1 },
  refundPercent: 50,
  starterKit: { switch: 1, dock: 2, gear: 1 },
  // ノルマの10倍で +1、100倍で +2、1000倍以上で +3（大きな連鎖を組む見返りを、次の買い物で返す）
  overshoot: { perDigit: 1, maxDigits: 3 },
};
