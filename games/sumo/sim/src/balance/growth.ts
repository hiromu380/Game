/**
 * 稽古と年齢による伸び・衰え、疲労とけが（すべてゲームの調整値）
 */
export const GROWTH = {
  /** 方針の能力が上限へ近づく割合（場所ごと） */
  focusRate: 0.07,
  /** 方針以外の能力の伸び */
  otherRate: 0.015,
  /** 若いうちの伸びの倍率（年齢 → 倍率） */
  youthBonusUntil: 22,
  youthBonus: 1.3,
  /** 親方の現役時代の型と同じ稽古の倍率 */
  oyakataStyleBonus: 1.3,
  /** 部屋付きの親方1人あたりの稽古の倍率（上限つき） */
  coachBonusPer: 0.05,
  coachBonusMax: 0.15,
  /** ピークを過ぎた後の衰え（年あたり、場所ごとに 1/6） */
  declinePerYear: 2.2,
  /** 体づくり: 体重の増え方（kg/場所）と、身長からの体重の上限（身長 − この値） */
  bodyGainKg: 3,
  otherGainKg: 0.8,
  weightCapOffset: 15,
  /** 疲労 */
  fatigueTraining: 18,
  fatigueRecovery: 12,
  fatigueRest: 40,
  /** 場所ごとのけがの確率: 基本 + 疲労 × 係数（けがのしやすさ 0〜1 を掛ける） */
  injuryBase: 0.02,
  injuryPerFatigue: 0.0025,
  /** けがで休む場所数 */
  injuryBashoMin: 1,
  injuryBashoMax: 3,
  /** けがのとき能力が落ちる量 */
  injuryAbilityLoss: 2,
  /** けがを押して出場（強行出場）: 調子の減点・場所中にけがをする確率の倍率・場所の後に悪化する確率 */
  playHurt: { conditionPenalty: 8, boutInjuryMultiplier: 3, worsenChance: 0.3 },
};
