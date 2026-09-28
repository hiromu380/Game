/**
 * ボルトのロケット（1ランの目的）の進み具合
 *
 * 見た目だけの情報で、ゲームの進行には影響しない。ランの状態（クリアしたシフト）から毎回計算するので、
 * セーブデータには何も足さない。
 * - 本編（通常ラン9シフト・デイリー3シフト）のクリアしたシフトに比例して部品が組み上がる。全部クリアで発射
 * - 延長戦は発射の後。1日クリアするごとに行き先が1つ遠くなる（config/rocket.ts）
 */
import type { RunState } from '@chain-factory/sim';
import { ROCKET_ASSETS } from '../assets/manifest';
import { ROCKET_CONFIG, type RocketDestination } from '../config/rocket';

/** ロケットの部品の数（絵の段階の数 - 1） */
export const ROCKET_PARTS = ROCKET_ASSETS.stages.length - 1;

export interface RocketProgress {
  /** 組み上がった部品の数（0〜ROCKET_PARTS） */
  parts: number;
  /** 発射したか（本編を全部クリアした） */
  launched: boolean;
  /** 延長戦で到達した行き先の数（0 = まだどこにも着いていない） */
  destinations: number;
}

/** 本編のシフト数（延長戦でシフト表が伸びても変わらない） */
function mainShiftCount(run: RunState): number {
  return run.config.baseShiftCount;
}

export function getRocketProgress(run: RunState): RocketProgress {
  const main = mainShiftCount(run);
  const cleared = run.history.filter((h) => h.cleared);
  const clearedMain = cleared.filter((h) => h.shiftIndex < main).length;
  const clearedOvertime = cleared.length - clearedMain;
  return {
    parts: Math.floor((Math.min(clearedMain, main) * ROCKET_PARTS) / main),
    launched: clearedMain >= main,
    destinations: Math.floor(clearedOvertime / run.config.shiftsPerDay),
  };
}

/**
 * 行き先の表示: n 番目（1 始まり）に届いた場所。一覧の最後より先は「最後の行き先 + 余りの日数」
 * n = 0（まだどこにも届いていない）なら null
 */
export function getDestination(n: number): { key: RocketDestination; extraDays: number } | null {
  if (n <= 0) return null;
  const list = ROCKET_CONFIG.destinations;
  const index = Math.min(n, list.length) - 1;
  return { key: list[index]!, extraDays: n - 1 - index };
}
