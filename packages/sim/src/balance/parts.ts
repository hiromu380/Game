/**
 * パーツ: 価格・発動回数・レア度、効果量（倍率など）、レア度ごとのショップ出現重み
 */
import type { Balance } from './types';

export const PARTS: Balance['parts'] = {
  switch: { price: 0, maxActivations: 1, rarity: null },
  conveyor: { price: 1, maxActivations: 3, rarity: 'common' },
  dock: { price: 3, maxActivations: null, rarity: 'common' },
  junkbot: { price: 2, maxActivations: 2, rarity: 'common' },
  gear: { price: 4, maxActivations: 1, rarity: 'common' },
  press: { price: 5, maxActivations: 1, rarity: 'uncommon' },
  splitter: { price: 2, maxActivations: 1, rarity: 'common' },
  barrel: { price: 5, maxActivations: 1, rarity: 'uncommon' },
  rebooter: { price: 5, maxActivations: 1, rarity: 'legendary' },
  // フェーズ2で追加
  merger: { price: 2, maxActivations: 2, rarity: 'uncommon' },
  chainMeter: { price: 8, maxActivations: 2, rarity: 'legendary' },
  spreader: { price: 2, maxActivations: 1, rarity: 'common' },
  copier: { price: 4, maxActivations: 1, rarity: 'uncommon' },
  reflector: { price: 1, maxActivations: 2, rarity: 'common' },
  // フェーズ3c: ほとんど買われていなかった（購入率 4〜11%）ため、挙動は変えず発動回数と価格を調整
  turntable: { price: 1, maxActivations: 8, rarity: 'uncommon' },
  // 信号には反応しない（常時効果のみ）ので発動回数は 0
  oiler: { price: 5, maxActivations: 0, rarity: 'rare' },
  coil: { price: 2, maxActivations: 1, rarity: 'common' },
  solar: { price: 3, maxActivations: 1, rarity: 'common' },
  inspector: { price: 5, maxActivations: 1, rarity: 'uncommon' },
  piggyBank: { price: 5, maxActivations: 3, rarity: 'uncommon' },
  // パーツ追加（SIM_VERSION 9。数値は仮: docs/balance-log.md）
  bend: { price: 1, maxActivations: 3, rarity: 'common' },
  crossSplitter: { price: 3, maxActivations: 1, rarity: 'uncommon' },
  magnet: { price: 5, maxActivations: 1, rarity: 'uncommon' },
  cornerBench: { price: 3, maxActivations: 1, rarity: 'common' },
  // 1回目は溜めるだけ、2回目で送るので発動回数は2
  capacitor: { price: 5, maxActivations: 2, rarity: 'rare' },
  teleporter: { price: 3, maxActivations: 2, rarity: 'rare' },
  booster: { price: 3, maxActivations: 1, rarity: 'common' },
  cashier: { price: 5, maxActivations: 2, rarity: 'rare' },
};

export const PART_PARAMS: Balance['partParams'] = {
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
  junkbotMinSteps: 1,
  junkbotMaxSteps: 6,
  junkbotStepDivisor: 2,
  crossSplitterDivisor: 2,
  magnetPerDock: 1,
  cornerBenchEdge: 2,
  cornerBenchCorner: 4,
  capacitorMultiplier: 2,
  boosterAdd: 5,
  cashierPerDigit: 1,
};

export const RARITY_WEIGHTS: Balance['rarityWeights'] = {
  common: 20,
  uncommon: 10,
  rare: 4,
  legendary: 1,
};

/**
 * 金色パーツ: 同じパーツを mergeCount 個、盤面で縦横につなげて置くと、合体できる（選んだマスが1つの金色パーツになる）。
 * 金色パーツは、パーツの効果の後で、送る信号の値と出荷量を multiplier 倍する（収入は増えない）。
 * excluded は合体しないパーツ（スイッチ = 1つしか持たない。共鳴コイル = 隣に並べるほど強いパーツで、合体とぶつかる）
 */
export const GOLDEN: Balance['golden'] = {
  mergeCount: 3,
  multiplier: 3,
  excluded: ['switch', 'coil'],
};
