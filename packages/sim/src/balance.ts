/**
 * バランス定数（ゲームの数値はすべてここに集約する）
 *
 * - コード中に倍率・価格・回数などを直書きしないこと
 * - ここを書き換えるだけで、シミュレーション・ラン進行の挙動が変わる
 * - 浮動小数点による環境差を避けるため、値はすべて整数で持つ
 */
import type { PartId } from './types';

/** パーツ1種ごとのバランス値 */
export interface PartBalance {
  /** ショップでの固定価格（フェーズ3で相場制に置き換え予定） */
  price: number;
  /** 1回のシミュレーション中に発動できる回数。null は無制限 */
  maxActivations: number | null;
  /** ショップに並ぶ重み（0 ならショップに出ない） */
  shopWeight: number;
}

export const BALANCE = {
  /** 工場フロアの広さ */
  board: {
    width: 7,
    height: 7,
  },

  /** シミュレーション全体の設定 */
  sim: {
    /** tick 上限。これに達したら強制終了（停止性の保証） */
    tickLimit: 500,
    /** スイッチが発射する信号の初期値 */
    switchSignalValue: 1,
  },

  /** パーツごとの価格・発動回数・ショップ出現率 */
  parts: {
    switch: { price: 0, maxActivations: 1, shopWeight: 0 },
    conveyor: { price: 1, maxActivations: 3, shopWeight: 12 },
    splitter: { price: 3, maxActivations: 1, shopWeight: 8 },
    gear: { price: 4, maxActivations: 1, shopWeight: 10 },
    press: { price: 4, maxActivations: 1, shopWeight: 8 },
    barrel: { price: 5, maxActivations: 1, shopWeight: 6 },
    junkbot: { price: 2, maxActivations: 2, shopWeight: 6 },
    rebooter: { price: 6, maxActivations: 1, shopWeight: 4 },
    dock: { price: 3, maxActivations: null, shopWeight: 6 },
  } satisfies Record<PartId, PartBalance>,

  /** パーツ固有の効果量 */
  effects: {
    /** 増幅ギア: 値に掛ける倍率 */
    gearMultiplier: 2,
    /** プレス機: 倍率 = base + 隣接パーツ数 × perNeighbor */
    pressBase: 1,
    pressPerNeighbor: 1,
  },

  /** ラン進行（シフト・予算・ノルマ） */
  run: {
    /** 各シフトの設定。配列の長さ = 1ランのシフト数 */
    shifts: [
      { quota: 5, budget: 12, clearReward: 5 },
      { quota: 40, budget: 10, clearReward: 5 },
      { quota: 250, budget: 10, clearReward: 0 },
    ],
    /** ラン開始時に手持ちとして配られるパーツ */
    starterKit: { switch: 1, dock: 1 } as Partial<Record<PartId, number>>,
    /** 撤去時の返金率（%）。切り捨て */
    refundPercent: 50,
    /** 撤去すると売却ではなく手持ちに戻るパーツ（スイッチは買い直せないため） */
    returnToInventoryOnRemove: ['switch'] as PartId[],
  },

  /** ショップ */
  shop: {
    /** 1シフトに並ぶ商品数 */
    offersPerShift: 5,
  },
} as const;

export type Balance = typeof BALANCE;
