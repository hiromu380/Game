/**
 * メタ進行（ランをまたいで残る進捗）の型
 *
 * 解放条件の判定などのロジックは 2b で追加する。ここでは保存形式だけを先に決めておく。
 */
import { PART_IDS, type PartId } from '../types';

export interface MetaRecords {
  /** 累計出荷量（scoreToString した文字列） */
  totalShipped: string;
  /** 到達した最大シフト（0 始まり） */
  bestShiftReached: number;
  /** 1回のシミュレーションでの最大連鎖数 */
  bestChain: number;
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
export function createInitialMeta(): MetaProgress {
  return {
    unlockedParts: [...PART_IDS],
    boardLevel: 0,
    records: { totalShipped: '0', bestShiftReached: 0, bestChain: 0, runsPlayed: 0, clears: 0 },
  };
}
