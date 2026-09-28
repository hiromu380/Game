/**
 * ラン進行の型定義
 *
 * RunState はそのまま JSON 化して保存できる形にしている（Score は文字列で保持）。
 */
import type { Board, PartId, SimStats } from '../types';

/** ショップの商品1つ */
export interface ShopOffer {
  partId: PartId;
  price: number;
  sold: boolean;
}

/** 確定したシフトの記録 */
export interface ShiftRecord {
  shiftIndex: number;
  /** 出荷量（scoreToString した文字列） */
  score: string;
  quota: number;
  cleared: boolean;
  chainCount: number;
}

/**
 * ランの進行状況
 * - building: 配置中（試運転は何度でも可能）
 * - cleared:  全シフトのノルマを達成してラン終了
 * - failed:   ノルマ未達でラン終了
 */
export type RunPhase = 'building' | 'cleared' | 'failed';

export interface RunState {
  /** ランのシード。シフトごとのシミュレーション・ショップのシードはここから派生する */
  seed: number;
  /** 現在のシフト（0 始まり） */
  shiftIndex: number;
  phase: RunPhase;
  budget: number;
  board: Board;
  /** 手持ち（購入済みで未配置のパーツ） */
  inventory: Partial<Record<PartId, number>>;
  shop: ShopOffer[];
  history: ShiftRecord[];
}

/** 操作の結果。失敗時は理由キー（i18n で表示する）を返す */
export type RunActionResult = { ok: true; state: RunState } | { ok: false; error: RunError };

export type RunError =
  | 'notBuilding'
  | 'offerNotFound'
  | 'alreadySold'
  | 'notEnoughBudget'
  | 'notInInventory'
  | 'cellOccupied'
  | 'cellEmpty'
  | 'outOfBoard';

/** simulate 結果のうち、ラン進行側で必要なもの */
export interface ShiftOutcome {
  cleared: boolean;
  quota: number;
  stats: SimStats;
}
