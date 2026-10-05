/**
 * シフト表（ノルマ・予算・報酬）: 通常ラン・延長戦・デイリー
 */
import type { Balance } from './types';

// 仮の値。`pnpm balance` のレポートを見て調整する
export const SHIFTS: Balance['shifts'] = [
  // 1日目
  { quota: 3, budget: 14, clearReward: 5, kind: 'normal' },
  { quota: 10, budget: 10, clearReward: 5, kind: 'normal' },
  { quota: 25, budget: 10, clearReward: 6, kind: 'boss' },
  // 2日目
  { quota: 80, budget: 12, clearReward: 5, kind: 'normal' },
  { quota: 250, budget: 12, clearReward: 5, kind: 'normal' },
  { quota: 600, budget: 12, clearReward: 6, kind: 'boss' },
  // 3日目
  { quota: 2000, budget: 14, clearReward: 5, kind: 'normal' },
  { quota: 4000, budget: 14, clearReward: 5, kind: 'normal' },
  { quota: 8000, budget: 14, clearReward: 0, kind: 'boss' },
];

export const SHIFTS_PER_DAY: Balance['shiftsPerDay'] = 3;

/** 2日目以降の朝に盤面を片付ける（その日にできたロケットの部品を運び出す）。パーツは手持ちに戻る */
export const RESET_BOARD_EACH_DAY: Balance['resetBoardEachDay'] = true;

export const OVERTIME: Balance['overtime'] = {
  quotaGrowthPercent: 250,
  budget: 14,
  clearReward: 5,
};

export const WEEKLY: Balance['weekly'] = {
  // 仮の値。デイリーは全パーツが出るので、通常ランの1日目より少し高め
  shifts: [
    { quota: 5, budget: 14, clearReward: 5, kind: 'normal' },
    { quota: 20, budget: 10, clearReward: 5, kind: 'normal' },
    { quota: 60, budget: 10, clearReward: 0, kind: 'boss' },
  ],
  specialRules: ['lowOil', 'repairWork', 'strictInspection', 'shortShift', 'partShortage'],
};
