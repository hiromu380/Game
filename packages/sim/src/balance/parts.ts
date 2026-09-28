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
  // フェーズ3c: ほとんど買われていなかった（購入率 4〜11%）ため、挙動は変えず発動回数と価格を調整
  turntable: { price: 1, maxActivations: 8, rarity: 'uncommon' },
  // 信号には反応しない（常時効果のみ）ので発動回数は 0
  oiler: { price: 6, maxActivations: 0, rarity: 'rare' },
  coil: { price: 2, maxActivations: 1, rarity: 'common' },
  solar: { price: 2, maxActivations: 1, rarity: 'common' },
  inspector: { price: 4, maxActivations: 1, rarity: 'uncommon' },
  piggyBank: { price: 3, maxActivations: 3, rarity: 'uncommon' },
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
};

export const RARITY_WEIGHTS: Balance['rarityWeights'] = { common: 10, uncommon: 5, rare: 2 };
