/**
 * バランス定数（ゲームの数値はすべてここに集約する）
 *
 * - コード中に倍率・価格・回数などを直書きしないこと
 * - ここを書き換えるだけで、シミュレーション・ラン進行の挙動が変わる
 *   （ただし進行中のランは開始時に確定した RunConfig を使うため影響しない）
 * - 浮動小数点による環境差を避けるため、値はすべて整数で持つ
 * - 調整は `pnpm balance` のレポートを根拠に行い、docs/balance-log.md に記録する
 */
import type { PartId } from './types';

/** レア度。ショップの出現重みの既定値を決める */
export type Rarity = 'common' | 'uncommon' | 'rare';

/** パーツ1種ごとのバランス値 */
export interface PartBalance {
  /** ショップでの固定価格（フェーズ3で相場制に置き換え予定） */
  price: number;
  /** 1回のシミュレーション中に発動できる回数。null は無制限 */
  maxActivations: number | null;
  /** レア度。null はショップに並ばない（スイッチなど） */
  rarity: Rarity | null;
  /** ショップの出現重みをレア度の既定値から上書きしたいときだけ指定する */
  shopWeight?: number;
}

/** パーツ固有の効果量（倍率など） */
export interface PartParams {
  /** 増幅ギア: 値に掛ける倍率 */
  gearMultiplier: number;
  /** プレス機: 倍率 = pressBase + 隣接パーツ数 × pressPerNeighbor */
  pressBase: number;
  pressPerNeighbor: number;
  /** 連鎖メーター: 倍率 = 連鎖数 ÷ chainMeterStep（切り捨て）+ 1 */
  chainMeterStep: number;
  /** コピー機: 2発目を何 tick 遅らせるか */
  copierDelay: number;
  /** 潤滑油タンク: 隣接パーツの発動回数上限に足す値 */
  oilerBonus: number;
  /** 共鳴コイル: 倍率 = 1 + 隣接する共鳴コイル数 × coilPerNeighbor */
  coilPerNeighbor: number;
  /** ソーラーパネル: 値に足す量 = 周囲8マスの空きマス数 × solarPerEmpty */
  solarPerEmpty: number;
  /** 検品台: 隣接4マスに出荷口があるときの倍率 */
  inspectorMultiplier: number;
  /** 貯金箱: 1回の発動で生む予算 */
  piggyBankIncome: number;
}

/** ボスシフトの修正ルールの種類 */
export type BossModifierId =
  'lowOil' | 'repairWork' | 'strictInspection' | 'shortShift' | 'partShortage';

/**
 * メタ進行の解放条件（ランをまたいだ実績で判定する）
 * - bestChain: 1回の稼働での最大連鎖数が value 以上
 * - reachShift: シフト value（1 始まり）に到達したことがある
 * - bestShiftScore: 1シフトの出荷量が value 以上になったことがある
 * - totalShipped: 累計出荷量が value 以上
 * - runsPlayed: ランを value 回遊んだ
 * - clears: 全シフトを value 回クリアした
 */
export interface MetaCondition {
  kind: 'bestChain' | 'reachShift' | 'bestShiftScore' | 'totalShipped' | 'runsPlayed' | 'clears';
  value: number;
}

/** 1シフトの設定 */
export interface ShiftSpec {
  /** ノルマ（出荷量） */
  quota: number;
  /** シフト開始時に受け取る予算 */
  budget: number;
  /** ノルマ達成時の報酬（次シフトの予算に加算） */
  clearReward: number;
  /** boss: ボス修正ルールが1つ適用される */
  kind: 'normal' | 'boss';
}

export interface Balance {
  /** 工場フロアの広さ（メタ進行の工場拡張はここに加算する） */
  board: { width: number; height: number };

  /** シミュレーション全体の設定 */
  sim: {
    /** tick 上限。これに達したら強制終了（停止性の保証） */
    tickLimit: number;
    /** スイッチが発射する信号の初期値 */
    switchSignalValue: number;
    /** 経済系パーツが1回のシミュレーションで生める予算の上限 */
    maxIncomePerSim: number;
    /**
     * 同時に存在できる信号の数の上限。再起動装置がリセットし合う配置などでは、
     * tick 上限より先に信号が爆発的に増えるため、これで打ち切って停止を保証する
     */
    maxLiveSignals: number;
  };

  /** パーツごとの価格・発動回数・レア度 */
  parts: Record<PartId, PartBalance>;
  /** パーツ固有の効果量 */
  partParams: PartParams;
  /** レア度ごとのショップ出現重み（既定値） */
  rarityWeights: Record<Rarity, number>;

  /** 経済（ショップ・売却・リロール） */
  economy: {
    /** 1シフトに並ぶ商品数 */
    offersPerShift: number;
    /** リロール価格 = baseCost + costStep × そのシフトでのリロール回数 */
    reroll: { baseCost: number; costStep: number };
    /** 売却時の返金率（%）。切り捨て */
    refundPercent: number;
    /** ラン開始時に手持ちとして配られるパーツ */
    starterKit: Partial<Record<PartId, number>>;
  };

  /** シフト表。配列の長さ = 1ランのシフト数（3日 × 朝・昼・夜） */
  shifts: ShiftSpec[];
  /** 1日あたりのシフト数（表示用: 何日目の何シフト目か） */
  shiftsPerDay: number;

  /** 延長戦（全シフトクリア後に続けられるエンドレス。1日の最後のシフトはボス） */
  overtime: {
    /** ノルマの伸び率（%）: 次のノルマ = 前のノルマ × quotaGrowthPercent / 100（切り捨て） */
    quotaGrowthPercent: number;
    budget: number;
    clearReward: number;
  };

  /** メタ進行（新パーツの解放・工場拡張） */
  meta: {
    /** 最初からショップに並ぶパーツ */
    initialUnlocked: PartId[];
    /** 実績で解放されるパーツ（上から順に表示する） */
    partUnlocks: { partId: PartId; condition: MetaCondition }[];
    /** 工場拡張（1段階ごとに盤面の縦横 +1）の条件 */
    boardExpansions: MetaCondition[];
  };

  /** ボス修正ルールの効果量 */
  boss: {
    /** 抽選対象のルール */
    candidates: BossModifierId[];
    /** 油切れ: コンベアの発動回数の増減 */
    lowOilConveyorDelta: number;
    /** 床の補修工事: 使用不可になるマス数 */
    repairWorkCells: number;
    /** 出荷検査強化: 出荷口の加算をこの値で割る（切り捨て） */
    strictInspectionDivisor: number;
    /** 短縮営業: tick 上限 */
    shortShiftTickLimit: number;
    /** 部品不足: ショップの品数の増減（リロールも不可になる） */
    partShortageOffersDelta: number;
  };
}

export const BALANCE: Balance = {
  board: { width: 7, height: 7 },

  sim: {
    tickLimit: 500,
    switchSignalValue: 1,
    maxIncomePerSim: 3,
    maxLiveSignals: 1000,
  },

  parts: {
    switch: { price: 0, maxActivations: 1, rarity: null },
    conveyor: { price: 1, maxActivations: 3, rarity: 'common' },
    dock: { price: 3, maxActivations: null, rarity: 'common' },
    junkbot: { price: 2, maxActivations: 2, rarity: 'common' },
    gear: { price: 4, maxActivations: 1, rarity: 'common' },
    press: { price: 4, maxActivations: 1, rarity: 'uncommon' },
    splitter: { price: 3, maxActivations: 1, rarity: 'common' },
    barrel: { price: 5, maxActivations: 1, rarity: 'uncommon' },
    rebooter: { price: 4, maxActivations: 1, rarity: 'rare' },
    // フェーズ2で追加
    merger: { price: 3, maxActivations: 2, rarity: 'uncommon' },
    chainMeter: { price: 7, maxActivations: 1, rarity: 'rare' },
    spreader: { price: 3, maxActivations: 1, rarity: 'common' },
    copier: { price: 4, maxActivations: 1, rarity: 'uncommon' },
    reflector: { price: 1, maxActivations: 2, rarity: 'common' },
    turntable: { price: 2, maxActivations: 4, rarity: 'uncommon' },
    // 信号には反応しない（常時効果のみ）ので発動回数は 0
    oiler: { price: 6, maxActivations: 0, rarity: 'rare' },
    coil: { price: 2, maxActivations: 1, rarity: 'common' },
    solar: { price: 2, maxActivations: 1, rarity: 'common' },
    inspector: { price: 4, maxActivations: 1, rarity: 'uncommon' },
    piggyBank: { price: 3, maxActivations: 3, rarity: 'uncommon' },
  },

  partParams: {
    gearMultiplier: 2,
    pressBase: 1,
    pressPerNeighbor: 1,
    chainMeterStep: 5,
    copierDelay: 1,
    oilerBonus: 1,
    coilPerNeighbor: 1,
    solarPerEmpty: 1,
    inspectorMultiplier: 3,
    piggyBankIncome: 1,
  },

  rarityWeights: { common: 10, uncommon: 5, rare: 2 },

  economy: {
    offersPerShift: 5,
    reroll: { baseCost: 1, costStep: 1 },
    refundPercent: 50,
    starterKit: { switch: 1, dock: 2, gear: 1 },
  },

  // 仮の値。`pnpm balance` のレポートを見て調整する
  shifts: [
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
  ],
  shiftsPerDay: 3,

  overtime: {
    quotaGrowthPercent: 250,
    budget: 14,
    clearReward: 5,
  },

  meta: {
    initialUnlocked: [
      'conveyor',
      'dock',
      'junkbot',
      'gear',
      'press',
      'splitter',
      'barrel',
      'rebooter',
      'spreader',
      'reflector',
      'coil',
      'solar',
    ],
    // 1回目のランで1〜2種、全クリアや延長戦でさらに、と段階的に増えるようにしている
    partUnlocks: [
      { partId: 'inspector', condition: { kind: 'bestShiftScore', value: 100 } },
      { partId: 'piggyBank', condition: { kind: 'runsPlayed', value: 2 } },
      { partId: 'turntable', condition: { kind: 'reachShift', value: 6 } },
      { partId: 'merger', condition: { kind: 'bestChain', value: 25 } },
      { partId: 'oiler', condition: { kind: 'reachShift', value: 9 } },
      { partId: 'copier', condition: { kind: 'totalShipped', value: 1_000_000 } },
      { partId: 'chainMeter', condition: { kind: 'bestChain', value: 50 } },
    ],
    boardExpansions: [
      { kind: 'clears', value: 1 },
      { kind: 'clears', value: 3 },
    ],
  },

  boss: {
    candidates: ['lowOil', 'repairWork', 'strictInspection', 'shortShift', 'partShortage'],
    lowOilConveyorDelta: -1,
    repairWorkCells: 2,
    strictInspectionDivisor: 2,
    shortShiftTickLimit: 30,
    partShortageOffersDelta: -2,
  },
};
