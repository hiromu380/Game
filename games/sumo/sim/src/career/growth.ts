/**
 * 場所の間の稽古: 能力の伸び・衰え、体重、疲労、けが
 */
import { GROWTH } from '../balance/growth';
import { clamp, round1 } from '../core/math';
import type { Prng } from '../core/prng';
import type { Abilities, Rikishi, Style } from '../model/types';

export interface GrowthContext {
  /** 親方の現役時代の型 */
  oyakataStyle: Style | null;
  /** 部屋付きの親方の数 */
  coaches: number;
  /** 家訓などによる型ごとの倍率 */
  styleMultiplier: Record<Style, number>;
  extraBodyKg: number;
  extraRecovery: number;
  /** 稽古場などによる伸びの倍率 */
  growthMultiplier: number;
  /** トレーナーなどによるけがの確率の倍率 */
  injuryMultiplier: number;
}

export const NEUTRAL_GROWTH: GrowthContext = {
  oyakataStyle: null,
  coaches: 0,
  styleMultiplier: { oshi: 1, yotsu: 1, waza: 1 },
  extraBodyKg: 0,
  extraRecovery: 0,
  growthMultiplier: 1,
  injuryMultiplier: 1,
};

const STYLES: Style[] = ['oshi', 'yotsu', 'waza'];

/** 1場所ぶんの稽古。けがをしたら true */
export function train(r: Rikishi, ctx: GrowthContext, rng: Prng): boolean {
  if (r.injury > 0) {
    // けがを押して出た場所の後は治らず、悪化することがある
    if (r.playHurt) {
      if (rng.chance(GROWTH.playHurt.worsenChance)) {
        r.injury++;
        for (const s of STYLES)
          r.abilities[s] = round1(Math.max(5, r.abilities[s] - GROWTH.injuryAbilityLoss));
        return true;
      }
      return false;
    }
    r.injury--;
    r.fatigue = clamp(r.fatigue - GROWTH.fatigueRest, 0, 100);
    return false;
  }
  const ageFactor =
    r.age <= GROWTH.youthBonusUntil ? GROWTH.youthBonus : r.age <= r.peakAge ? 1 : 0;
  const coach =
    (1 + Math.min(GROWTH.coachBonusMax, ctx.coaches * GROWTH.coachBonusPer)) * ctx.growthMultiplier;
  const grow = (key: keyof Abilities, rate: number) => {
    const a = r.abilities[key];
    if (a >= r.talent || ageFactor === 0) return;
    const style = key as Style;
    const bonus =
      (ctx.oyakataStyle === style ? GROWTH.oyakataStyleBonus : 1) * ctx.styleMultiplier[style];
    const noise = 0.5 + rng.nextInt(1001) / 1000;
    r.abilities[key] = round1(
      Math.min(r.talent, a + (r.talent - a) * rate * ageFactor * coach * bonus * noise),
    );
  };
  if (r.policy === 'rest') {
    r.fatigue = clamp(r.fatigue - GROWTH.fatigueRest - ctx.extraRecovery, 0, 100);
  } else {
    for (const s of STYLES) grow(s, r.policy === s ? GROWTH.focusRate : GROWTH.otherRate);
    r.fatigue = clamp(
      r.fatigue + GROWTH.fatigueTraining - GROWTH.fatigueRecovery - ctx.extraRecovery,
      0,
      100,
    );
  }
  // 体重（身長 − 一定 まで）
  const cap = r.height - GROWTH.weightCapOffset;
  if (r.age < 32 && r.weight < cap) {
    const gain =
      r.policy === 'body'
        ? GROWTH.bodyGainKg + ctx.extraBodyKg
        : r.policy === 'rest'
          ? 0
          : GROWTH.otherGainKg;
    r.weight = round1(Math.min(cap, r.weight + gain));
  }
  // ピークを過ぎると衰える（年を取るほど速く）
  if (r.age > r.peakAge) {
    const over = r.age - r.peakAge;
    const loss = (GROWTH.declinePerYear / 6) * (1 + over * GROWTH.declineAccel);
    for (const s of STYLES) r.abilities[s] = round1(Math.max(5, r.abilities[s] - loss));
  }
  // けが
  const chance =
    (GROWTH.injuryBase + r.fatigue * GROWTH.injuryPerFatigue) *
    r.fragility *
    2 *
    ctx.injuryMultiplier;
  if (rng.chance(chance)) {
    r.injury = rng.range(GROWTH.injuryBashoMin, GROWTH.injuryBashoMax);
    for (const s of STYLES)
      r.abilities[s] = round1(Math.max(5, r.abilities[s] - GROWTH.injuryAbilityLoss));
    return true;
  }
  return false;
}

/** 架空の部屋の稽古の方針（疲れたら休む・軽い力士は体づくり・ほかは部屋の型） */
export function npcPolicy(r: Rikishi, style: Style): Rikishi['policy'] {
  if (r.fatigue >= 60) return 'rest';
  if (r.weight < 110) return 'body';
  return style;
}
