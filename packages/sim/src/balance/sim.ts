/**
 * 盤面の広さ・シミュレーション全体の上限・出荷量の表示の上限（計測不能）
 */
import type { Balance } from './types';

export const BOARD: Balance['board'] = { width: 7, height: 7 };

export const SIM: Balance['sim'] = {
  tickLimit: 500,
  switchSignalValue: 1,
  maxIncomePerSim: 3,
  maxLiveSignals: 1000,
};

/**
 * 計測不能の桁数。延長戦をボットに遊ばせた到達点から決めた（docs/balance-log.md「計測不能」）。
 * 17 桁 = 1京。ボットの到達点（最大 15 桁）より上で、延長戦を深く進めた人だけが見られる高さにする
 */
export const UNMEASURABLE: Balance['unmeasurable'] = { digits: 17 };
