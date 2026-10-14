/**
 * バランス値の型（値そのものは同じフォルダの各ファイル）
 */
import type { FloorTileId } from '../floor/types';
import type { PartId } from '../types';

/** レア度。ショップの出現重み・レリックの候補の重みを決める（低い順） */
export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';

/** レア度（低い順。表示の並び順にも使う） */
export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'legendary'];

/**
 * レリックのバランス値
 *
 * 候補の出やすさはレア度で決め、夜が進むほど上位が出やすい（weightsByNight[i] は i 日目の夜。足りない日は最後の値）。
 * weights はレア度を導入する前のラン（RunConfig に写した値）だけが持つ、レリックごとの出やすさ
 */
export interface RelicBalance {
  choices: number;
  rarity?: Record<RelicId, Rarity>;
  weightsByNight?: Record<Rarity, number>[];
  weights?: Record<RelicId, number>;
  params: RelicParams;
}

/**
 * 1シフトに何回スイッチを押せるか（試作。perShift が 1 なら従来どおり1回で確定）
 *
 * 2回以上のときは、押した回の出荷量の合計でノルマを目指す。ノルマに届いたらそのシフトは終わり、
 * 押さずに残った回数 × spareReward を報酬に足す。ある回に発動したマスは次の回だけ過熱する（通り抜けるだけ）
 */
export interface PressBalance {
  perShift: number;
  spareReward: number;
  /** 過熱しないパーツ（通り道・出荷口） */
  overheatExempt: PartId[];
}

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
  /** 十字分岐器: 4方向へ送る値 = 受けた値 ÷ crossSplitterDivisor（切り捨て） */
  crossSplitterDivisor: number;
  /** 磁石: 倍率 = 1 + 同じ行・列の出荷口の数 × magnetPerDock */
  magnetPerDock: number;
  /** 隅の作業台: 盤面の端・角に置いたときの倍率 */
  cornerBenchEdge: number;
  cornerBenchCorner: number;
  /** 蓄電器: 2回目に送る値 =（溜めた値 + 今の値）× capacitorMultiplier */
  capacitorMultiplier: number;
  /** ブースター: 値に足す量 */
  boosterAdd: number;
  /** 換金機: 予算 = 値の桁数 × cashierPerDigit */
  cashierPerDigit: number;
}

/**
 * 日ごとのイベント（2日目以降の朝に3つの候補から1つ選ぶ。効果はその日のうちだけ）
 * - supplies: 差し入れ（予算が増える）
 * - sample: 試供品（アンコモン以上のパーツを1つもらえる）
 * - sale: 特売日（ショップが全品値引き）
 * - clearance: 在庫整理（売却の返金率が上がる）
 * - overtimePay: 残業手当（ノルマ達成の報酬が増える）
 * - rollUpSleeves: 腕まくり（朝シフトのノルマが下がる）
 */
/** レリック（夜のシフトをクリアすると3つの候補から1つ選ぶ。ランの終わりまで効く） */
export const RELIC_IDS = [
  'spareSwitch',
  'gearGloves',
  'rewoundCoil',
  'doubleCheck',
  'chainPulse',
  'goldLeaf',
  'junkbotHunch',
  'polishedFloor',
  'spareOil',
  'afterglow',
  'piggyHabit',
  'coupon',
  'connoisseur',
  'nightPay',
  'floorCraftsman',
] as const;
export type RelicId = (typeof RELIC_IDS)[number];

/** レリックの効果量 */
export interface RelicParams {
  /** 予備のスイッチ: スイッチの信号の初期値に足す */
  spareSwitchAdd: number;
  /** ギア職人の手袋: 増幅ギアの倍率に足す */
  gearAdd: number;
  /** 巻き直したコイル: 共鳴コイルの「隣接1つあたり」に足す */
  coilAdd: number;
  /** 二重チェック: 検品台の倍率に足す */
  inspectorAdd: number;
  /** 連鎖の鼓動: 連鎖メーターの割る数から引く（最低1） */
  chainMeterStepDelta: number;
  /** 金箔: 金色パーツの倍率に足す */
  goldenAdd: number;
  /** 磨いた床: ×2床の倍率 */
  polishedDoubleMultiplier: number;
  /** 予備の油: 全パーツの発動回数上限に足す（上限なし・0 のパーツは除く） */
  spareOilAdd: number;
  /** 余熱: 爆発ドラム缶の発動回数上限に足す */
  afterglowAdd: number;
  /** 貯金癖: 貯金箱の収入に足す */
  piggyAdd: number;
  /** 割引クーポン: パーツの価格から引く（最低1） */
  couponDiscount: number;
  /** 目利き: ショップの枠に足す */
  connoisseurOffers: number;
  /** 夜勤手当: 夜のシフトのクリア報酬に足す */
  nightPayReward: number;
  /** 床職人: シフト開始時のボーナス床の枚数に足す */
  floorCraftsmanAdd: number;
}

export type DayEventId =
  | 'supplies'
  | 'sample'
  | 'sale'
  | 'clearance'
  | 'overtimePay'
  | 'rollUpSleeves'
  | 'floorCenter'
  | 'floorRepair'
  | 'floorAdds';

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

/** 床タイルの効果量（floor/tiles/ が参照する） */
export interface FloorParams {
  /** ×2床の倍率 */
  doubleMultiplier: number;
  /** 加算床で足す値 */
  addAmount: number;
  /** ×3床の倍率 */
  tripleMultiplier: number;
}

/**
 * 日ごとのステージ（床の配置）
 * テンプレートは 7×7 の文字列（1文字 = 1マス。'.' 床なし・'2' ×2床・'+' 加算床・'3' ×3床・'#' 使用不可）。
 * 回転・反転で水増しし、8×8・9×9 ではシードで決めた位置に埋め込む（floor/stage.ts）
 */
export interface StageBalance {
  templates: Record<string, string[]>;
  /** 本編の日ごとに抽選するテンプレート（index = 日。足りない日は最後の帯を使う） */
  dayBands: string[][];
  /** 延長戦の日に抽選するテンプレート */
  overtimeBand: string[];
  /** 延長戦の日が進むごとに、×2床を×3床に置き換える枚数（延長戦の1日目から数える） */
  overtimeUpgradesPerDay: number;
  /** 週替わり（1日分・3シフト）で抽選するテンプレート */
  weeklyBand: string[];
  /** 週替わりの盤面が自動検証に通らなかったときの代替の帯（やさしいステージ。特殊ルールなし） */
  weeklyFallbackBand: string[];
  /** 初回ガイドの1日目に使うテンプレート（抽選しない・回転しない） */
  tutorialTemplate: string;
  /** 使用不可を除いたマスが、盤面のこの割合（%）以上あること（テンプレートの検証） */
  minFreePercent: number;
  /** 生成の試行回数の上限（超えたら帯の最初のテンプレートをそのまま使う） */
  maxAttempts: number;
}

/** シフト開始時のボーナス床（空きマスに湧く。そのシフトのみ有効） */
export interface BonusFloorBalance {
  /** 湧く枚数の重み（index = 枚数。例: [0, 70, 30] なら 1枚 70・2枚 30） */
  countWeights: number[];
  /** 湧く床の種類の重み */
  tileWeights: { tile: FloorTileId; weight: number }[];
}

/** 消耗品の種類（手持ちのパーツとは別に持つ。今はランダム配置権だけ） */
export type ItemId = 'floorPermit';

/**
 * ランダム配置権: 使うと、盤面のどこかに床が1枚湧く。日が変わると、使っていない配置権も湧いた床も消える
 */
export interface FloorPermitBalance {
  price: number;
  /** ショップを引くたびに、品揃えの1枠が配置権になる確率（%）。1回の品揃えで最大1枠 */
  offerChancePercent: number;
  /** 同時に持てる枚数 */
  maxHeld: number;
  /** 湧く床の種類の重み。fromDay（0 始まり）より前の日には出さない */
  tileWeights: { tile: FloorTileId; weight: number; fromDay?: number }[];
  /** 週替わりチャレンジでも出すか */
  inWeekly: boolean;
}

/** 金色パーツ（parts.ts の GOLDEN） */
export interface GoldenBalance {
  /** 合体に必要な、縦横につながった同じパーツの数 */
  mergeCount: number;
  /** 金色パーツが送る信号の値・出荷量に掛ける倍率（パーツの効果の後） */
  multiplier: number;
  /** 合体しないパーツ */
  excluded: PartId[];
}

/** 残業レベル1段で増える条件（指定したものだけ。数値は足し算・quotaPercent は掛け算で重ねる） */
export interface AscensionEffect {
  /** ノルマを何%にするか（通常ランの全シフト。切り上げ） */
  quotaPercent?: number;
  /** 毎シフトの予算に足す（マイナスで減る。最低 0。延長戦の予算も） */
  budgetDelta?: number;
  /** リロールの値上がり幅に足す */
  rerollStepDelta?: number;
  /** シフト開始時のボーナス床の枚数に足す（マイナスで減る。最低 0 枚） */
  bonusFloorDelta?: number;
  /** パーツの価格に足す（価格 0 のパーツは除く） */
  priceDelta?: number;
  /** レリックの候補の数に足す（最低 1） */
  relicChoicesDelta?: number;
  /** 今日の出来事の候補の数に足す（最低 1） */
  eventChoicesDelta?: number;
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
    /** 合流炉が同じ tick の信号をどうまとめるか（product: 掛け算 / sum: 足し算） */
    mergeMode: 'product' | 'sum';
    /**
     * 同時出荷ボーナス: 同じ tick に出荷した出荷口の数を、その tick の出荷量に掛ける。
     * この値で倍率を抑える（1 ならボーナスなし）
     */
    syncShipMax: number;
  };

  /**
   * 「計測不能」: 1シフトの出荷量がこの桁数以上になったら、画面では数字の代わりに「計測不能」と出す
   * （演出・隠し実績・シェア文も。表示だけで、内部の値・ランキングの並びは正確な値のまま）
   */
  unmeasurable: { digits: number };

  /** パーツごとの価格・発動回数・レア度 */
  parts: Record<PartId, PartBalance>;
  /** パーツ固有の効果量 */
  partParams: PartParams;
  /** 床タイルの効果量 */
  floorParams: FloorParams;
  /** 日ごとのステージ（床の配置） */
  stages: StageBalance;
  /** シフト開始時のボーナス床 */
  bonusFloors: BonusFloorBalance;
  /** ランダム配置権 */
  floorPermit: FloorPermitBalance;
  /** レア度ごとのショップ出現重み（既定値） */
  rarityWeights: Record<Rarity, number>;
  /** 金色パーツ（同じパーツを盤面で3つつなげると合体する） */
  golden: GoldenBalance;

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
  /** 2日目以降の朝（1日の最初のシフト）に、盤面のパーツをすべて手持ちに戻すか（毎日組み直す） */
  resetBoardEachDay: boolean;
  /** 1シフトにスイッチを押せる回数と、過熱・押さずに残った回数の報酬（試作） */
  presses: PressBalance;

  /** 日ごとのイベント（2日目以降の朝に選ぶ） */
  dayEvents: {
    /** 抽選対象のイベント */
    candidates: DayEventId[];
    /** 候補の数（この中から1つ選ぶ） */
    choices: number;
    /** 差し入れ: 増える予算 */
    suppliesBudget: number;
    /** 試供品: もらえるパーツのレア度 */
    sampleRarities: Rarity[];
    /** 特売日: 値引き額（価格は最低 1） */
    saleDiscount: number;
    /** 在庫整理: 売却の返金率（%） */
    clearanceRefundPercent: number;
    /** 残業手当: ノルマ達成の報酬の倍率（%） */
    overtimePayPercent: number;
    /** 腕まくり: 朝シフトのノルマの倍率（%。切り捨て、最低 1） */
    rollUpSleevesQuotaPercent: number;
    /** 中央の床: 盤面の中央（床のないいちばん近いマス）に湧く床 */
    floorCenterTile: FloorTileId;
    /** 加算床の差し入れ: 湧く加算床の枚数 */
    floorAddsCount: number;
  };

  /** 延長戦（全シフトクリア後に続けられるエンドレス。1日の最後のシフトはボス） */
  overtime: {
    /** ノルマの伸び率（%）: 次のノルマ = 前のノルマ × quotaGrowthPercent / 100（切り捨て） */
    quotaGrowthPercent: number;
    budget: number;
    clearReward: number;
  };

  /** 週替わりチャレンジ（1回の挑戦＝3シフトの短縮版。全員同じ条件で1週間） */
  weekly: {
    /** シフト表（朝・昼・夜。夜はボス） */
    shifts: ShiftSpec[];
    /** 「今週の特殊ルール」の候補（ボス修正ルールの仕組みを流用し、3シフト全体にかける） */
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

  /** レリック（choices: 候補の数・rarity: レア度・weightsByNight: 何日目の夜か → レア度ごとの出やすさ） */
  relics: RelicBalance;
  /** 残業レベル（段階式の高難度）。levels[i] は Lv(i+1) で増える条件。Lv L は 1〜L の条件をすべて重ねる */
  ascension: { levels: AscensionEffect[] };

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
