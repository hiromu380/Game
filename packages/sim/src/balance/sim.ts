/**
 * 盤面の広さ・シミュレーション全体の上限
 */
import type { Balance } from './types';

export const BOARD: Balance['board'] = { width: 7, height: 7 };

export const SIM: Balance['sim'] = {
  tickLimit: 500,
  switchSignalValue: 1,
  maxIncomePerSim: 3,
  maxLiveSignals: 1000,
};
