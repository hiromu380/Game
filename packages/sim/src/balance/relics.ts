/**
 * レリック: 夜（ボス）のシフトをクリアすると、3つの候補から1つ選んでもらえる。持っているあいだ、ランの終わりまでずっと効く
 *
 * 候補の出やすさはレア度と何日目の夜かで決まる（夜が進むほど上位が出やすい）。効果量は params に置く（数値は仮: docs/balance-log.md）
 */
import type { Balance } from './types';

export const RELICS: Balance['relics'] = {
  choices: 3,
  rarity: {
    gearGloves: 'common',
    rewoundCoil: 'common',
    doubleCheck: 'common',
    junkbotHunch: 'common',
    piggyHabit: 'common',
    nightPay: 'common',
    afterglow: 'uncommon',
    coupon: 'uncommon',
    connoisseur: 'uncommon',
    floorCraftsman: 'uncommon',
    chainPulse: 'rare',
    goldLeaf: 'rare',
    polishedFloor: 'rare',
    spareSwitch: 'legendary',
    spareOil: 'legendary',
  },
  // 1日目の夜・2日目の夜・延長戦の夜（3日目以降）
  weightsByNight: [
    { common: 10, uncommon: 5, rare: 1, legendary: 0 },
    { common: 6, uncommon: 6, rare: 3, legendary: 1 },
    { common: 4, uncommon: 5, rare: 4, legendary: 2 },
  ],
  params: {
    spareSwitchAdd: 1,
    gearAdd: 1,
    coilAdd: 1,
    inspectorAdd: 1,
    chainMeterStepDelta: 1,
    goldenAdd: 1,
    polishedDoubleMultiplier: 3,
    spareOilAdd: 1,
    afterglowAdd: 1,
    piggyAdd: 1,
    couponDiscount: 1,
    connoisseurOffers: 1,
    nightPayReward: 3,
    floorCraftsmanAdd: 1,
  },
};
