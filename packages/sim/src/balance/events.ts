/**
 * 日ごとのイベント: 2日目以降の朝に、候補から1つ選ぶ（効果はその日のうちだけ）
 */
import type { Balance } from './types';

export const DAY_EVENTS: Balance['dayEvents'] = {
  candidates: [
    'supplies',
    'sample',
    'sale',
    'clearance',
    'overtimePay',
    'rollUpSleeves',
    'floorCenter',
    'floorRepair',
    'floorAdds',
  ],
  choices: 3,
  suppliesBudget: 5,
  sampleRarities: ['uncommon', 'rare'],
  saleDiscount: 1,
  clearanceRefundPercent: 100,
  overtimePayPercent: 200,
  rollUpSleevesQuotaPercent: 50,
  floorCenterTile: 'double',
  floorAddsCount: 2,
};
