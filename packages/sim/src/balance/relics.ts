/**
 * レリック: 夜（ボス）のシフトをクリアすると、3つの候補から1つ選んでもらえる。持っているあいだ、ランの終わりまでずっと効く
 *
 * weight は候補に選ばれやすさ（大きいほど出やすい）。効果量は params に置く（数値は仮: docs/balance-log.md）
 */
import type { Balance } from './types';

export const RELICS: Balance['relics'] = {
  choices: 3,
  weights: {
    spareSwitch: 4,
    gearGloves: 10,
    rewoundCoil: 10,
    doubleCheck: 10,
    chainPulse: 8,
    goldLeaf: 8,
    junkbotHunch: 10,
    polishedFloor: 8,
    spareOil: 3,
    afterglow: 10,
    piggyHabit: 10,
    coupon: 8,
    connoisseur: 8,
    nightPay: 10,
    floorCraftsman: 8,
  },
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
