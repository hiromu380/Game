/**
 * テスト用のバランス（本番の balance/ を元に、必要な値だけ差し替える）
 */
import { BALANCE, type Balance, type ShiftSpec } from '../src';

/** ノルマ 1 のシフトを n 個並べたシフト表 */
export function easyShifts(count: number, bossEvery = 3): ShiftSpec[] {
  return Array.from({ length: count }, (_, i) => ({
    quota: 1,
    budget: 10,
    clearReward: 2,
    kind: (i + 1) % bossEvery === 0 ? 'boss' : 'normal',
  }));
}

export function withBalance(patch: Partial<Balance>): Balance {
  return { ...BALANCE, ...patch };
}
