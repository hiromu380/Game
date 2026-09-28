/**
 * バランス値の型（値そのものは同じフォルダの各ファイル）
 */
import type { PartId } from '../types';

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
  /**
   * ポンコツロボ: 値に掛ける倍率 = （junkbotMinSteps〜junkbotMaxSteps の乱数）÷ junkbotStepDivisor（切り捨て）。
   * シミュレーションでは小数を使わないため、倍率を「整数 ÷ 整数」で表す（既定: 1〜6 ÷ 2 = ×0.5〜×3、0.5 刻み）
   */
  junkbotMinSteps: number;
  junkbotMaxSteps: number;
  junkbotStepDivisor: number;
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

  /** デイリーチャレンジ（1日＝3シフトの短縮版。全員同じ条件） */
  daily: {
    /** シフト表（朝・昼・夜。夜はボス） */
    shifts: ShiftSpec[];
    /** 「今日の特殊ルール」の候補（ボス修正ルールの仕組みを流用し、3シフト全体にかける） */
    specialRules: BossModifierId[];
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
