/**
 * メタ進行（ランをまたいで残る進捗）の型
 */
import { BALANCE, type Balance } from '../balance';
import type { PartId } from '../types';

export interface MetaRecords {
  /** 累計出荷量（scoreToString した文字列） */
  totalShipped: string;
  /** 到達した最大シフト（0 始まり） */
  bestShiftReached: number;
  /** 1回のシミュレーションでの最大連鎖数 */
  bestChain: number;
  /** 1シフトの最大出荷量（scoreToString した文字列） */
  bestShiftScore: string;
  runsPlayed: number;
  /** 全シフトをクリアした回数 */
  clears: number;
}

export interface MetaProgress {
  /** ショップに並ぶ（解放済みの）パーツ */
  unlockedParts: PartId[];
  /** 工場拡張の段階（0: 7×7, 1: 8×8, 2: 9×9） */
  boardLevel: number;
  records: MetaRecords;
}

/** 初めて遊ぶときのメタ進行 */
export function createInitialMeta(balance: Balance = BALANCE): MetaProgress {
  return {
    unlockedParts: [...balance.meta.initialUnlocked],
    boardLevel: 0,
    records: {
      totalShipped: '0',
      bestShiftReached: 0,
      bestChain: 0,
      bestShiftScore: '0',
      runsPlayed: 0,
      clears: 0,
    },
  };
}
