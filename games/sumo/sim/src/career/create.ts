/**
 * 力士・入門希望者を作る
 */
import { GROWTH } from '../balance/growth';
import { RECRUIT } from '../balance/career';
import { MOCHIKYUKIN } from '../balance/money';
import { clamp } from '../core/math';
import type { Prng } from '../core/prng';
import type { Abilities, Candidate, Career, Rikishi, Style } from '../model/types';

export function emptyCareer(): Career {
  return {
    basho: 0,
    makuuchiBasho: 0,
    sekitoriBasho: 0,
    sanyakuBasho: 0,
    wins: 0,
    losses: 0,
    absences: 0,
    makuuchiYusho: 0,
    otherYusho: 0,
    kinboshi: 0,
    sansho: { shukun: 0, kanto: 0, gino: 0 },
    mochikyukinHalf: MOCHIKYUKIN.startHalf,
    highestOrder: Number.MAX_SAFE_INTEGER,
    highestRank: null,
    earnings: 0,
  };
}

/** 素質（伸びの上限）。名声が高いほど良い素質が来る */
export function rollTalent(rng: Prng, prestige: number): number {
  const bonus = Math.min(RECRUIT.talentPrestigeMax, prestige * RECRUIT.talentPerPrestige);
  const base = rng.chance(RECRUIT.talentStarChance)
    ? rng.range(RECRUIT.talentStarMin, 100)
    : rng.chance(RECRUIT.talentRareChance)
      ? rng.range(RECRUIT.talentMax, RECRUIT.talentRareMax)
      : rng.range(RECRUIT.talentMin, RECRUIT.talentMax);
  return clamp(Math.round(base + bonus), RECRUIT.talentMin, 100);
}

/** 型の傾き（得意な型が少し高い） */
export function rollAbilities(rng: Prng, min: number, max: number, style?: Style): Abilities {
  const a: Abilities = {
    oshi: rng.range(min, max),
    yotsu: rng.range(min, max),
    waza: rng.range(min, max),
  };
  if (style) a[style] += rng.range(2, 6);
  return a;
}

/** noise: 見立て（素質の星）の誤差の幅 */
export function makeCandidate(
  rng: Prng,
  id: number,
  name: string,
  prestige: number,
  allowForeign: boolean,
  noise = 10,
  /** スカウト回り: 経歴を決める・素質を上乗せする・外国出身にする */
  opts: { background?: Candidate['background']; talentBonus?: number; foreign?: boolean } = {},
): Candidate {
  const background =
    opts.background ??
    rng.pick(['juniorHigh', 'highSchool', 'highSchool', 'college', 'otherSport'] as const);
  const age =
    background === 'juniorHigh'
      ? 15
      : background === 'highSchool'
        ? 18
        : background === 'college'
          ? 22
          : rng.range(17, 22);
  const height = rng.range(RECRUIT.minHeight, 192);
  const weight = rng.range(Math.max(RECRUIT.minWeight, height - 90), height - 40);
  const talent = clamp(rollTalent(rng, prestige) + (opts.talentBonus ?? 0), 1, 100);
  // 学生相撲の経験者は入門時に少し強い
  const exp = background === 'college' ? 8 : background === 'highSchool' ? 4 : 0;
  const abilities = rollAbilities(
    rng,
    RECRUIT.startAbilityMin + exp,
    RECRUIT.startAbilityMax + exp,
  );
  // 見える素質は誤差つき（1〜5）
  const noisy = talent + rng.range(-noise, noise);
  const scoutGrade = clamp(Math.round((noisy - 30) / 14), 1, 5);
  return {
    id,
    name,
    age,
    height,
    weight,
    foreign: opts.foreign ?? (allowForeign && rng.chance(0.08)),
    abilities,
    talent,
    peakAge: rng.range(GROWTH.peakAge[0], GROWTH.peakAge[1]),
    fragility: rng.range(10, 90) / 100,
    scoutGrade,
    background,
  };
}

export function rikishiFromCandidate(
  c: Candidate,
  stableId: number,
  policy: Rikishi['policy'],
): Rikishi {
  return {
    id: c.id,
    name: c.name,
    stableId,
    age: c.age,
    height: c.height,
    weight: c.weight,
    abilities: { ...c.abilities },
    talent: c.talent,
    peakAge: c.peakAge,
    fragility: c.fragility,
    fatigue: 0,
    injury: 0,
    foreign: c.foreign,
    policy,
    career: emptyCareer(),
    recent: [],
    exOzeki: false,
    playHurt: false,
    track: [],
    boost: 1,
  };
}

export function styleOf(a: Abilities): Style {
  if (a.oshi >= a.yotsu && a.oshi >= a.waza) return 'oshi';
  if (a.yotsu >= a.waza) return 'yotsu';
  return 'waza';
}
