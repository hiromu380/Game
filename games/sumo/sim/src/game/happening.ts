/**
 * 場所の間の出来事: 次の場所の前に起きる出来事を選び、プレイヤーの答えで効果を出す
 */
import {
  HAPPENING_CHANCE,
  HAPPENING_COOLDOWN,
  HAPPENING_MANY,
  HAPPENING_RICH,
  HAPPENING_VETERAN_MIN,
  HAPPENING_YOUNG_MAX,
  HAPPENINGS,
  type HappeningDef,
  type HappeningEffect,
  type HappeningGroup,
  type HappeningTarget,
} from '../balance/happenings';
import { GROWTH } from '../balance/growth';
import { isSekitori, ranksOf } from '../banzuke/rank';
import { makeCandidate, styleOf } from '../career/create';
import { clamp } from '../core/math';
import { lineageCharOf, makeShikona } from '../core/names';
import { createPrng, deriveSeed, SEED, type Prng } from '../core/prng';
import type { GameState, Rank, Rikishi } from '../model/types';
import { hasTrait } from '../career/traits';

function mine(state: GameState): Rikishi[] {
  return state.rikishi.filter((r) => r.stableId === state.player.stableId);
}

function rankTest(state: GameState): (r: Rikishi) => Rank | undefined {
  const ranks = ranksOf(state.banzuke, state.titles);
  return (r) => ranks.get(r.id);
}

const upper = (rank: Rank | undefined) =>
  rank !== undefined && (isSekitori(rank) || rank.division === 'makushita');

/** 条件に合う自分の弟子 */
function targetsOf(state: GameState, kind: HappeningTarget): Rikishi[] {
  const rankOf = rankTest(state);
  return mine(state).filter((r) => {
    const rank = rankOf(r);
    switch (kind) {
      case 'injured':
        return r.injury > 0;
      case 'young':
        return r.age <= HAPPENING_YOUNG_MAX && !upper(rank);
      case 'veteran':
        return r.age >= HAPPENING_VETERAN_MIN;
      case 'sekitori':
        return rank !== undefined && isSekitori(rank);
      case 'sekitoriAdult':
        return rank !== undefined && isSekitori(rank) && r.age >= 25;
      case 'upper':
        return upper(rank);
      case 'lower':
        return !upper(rank);
      case 'foreign':
        return r.foreign;
      case 'any':
        return true;
    }
  });
}

function groupOf(
  state: GameState,
  group: HappeningGroup | undefined,
  target: number | null,
): Rikishi[] {
  if (group === undefined) return [];
  if (group === 'target') return mine(state).filter((r) => r.id === target);
  const rankOf = rankTest(state);
  return mine(state).filter((r) => {
    const rank = rankOf(r);
    if (group === 'sekitori') return rank !== undefined && isSekitori(rank);
    if (group === 'upper') return upper(rank);
    if (group === 'lower') return !upper(rank);
    return true;
  });
}

function eligible(state: GameState, def: HappeningDef): boolean {
  if (def.months && !def.months.includes(state.bashoIndex % 6)) return false;
  if (
    state.happeningLog.some(
      (h) => h.id === def.id && state.bashoIndex - h.bashoIndex < HAPPENING_COOLDOWN,
    )
  )
    return false;
  if (def.target && targetsOf(state, def.target).length === 0) return false;
  switch (def.requires) {
    case 'none':
      return true;
    case 'sekitori':
    case 'upper':
      return groupOf(state, def.requires, null).length > 0;
    case 'many':
      return mine(state).length >= HAPPENING_MANY;
    case 'rich':
      return state.player.stableMoney >= HAPPENING_RICH;
    case 'heyatsuki':
      return state.oyakata.some(
        (o) => o.stableId === state.player.stableId && o.role === 'heyatsuki',
      );
    case 'alumni':
      return state.player.alumni.length > 0;
    case 'noForeign':
      return !mine(state).some((r) => r.foreign);
  }
}

/** 当人を選ぶ。ホームシック・脱走は繊細な弟子、食事の誘いは人気者が先に選ばれる */
function pickTarget(id: HappeningDef['id'], pool: Rikishi[], rng: Prng): Rikishi {
  const prefer =
    id === 'homesick' || id === 'runaway'
      ? 'sensitive'
      : id === 'tanimachiDinner' || id === 'hometownCheer'
        ? 'popular'
        : null;
  const preferred = prefer ? pool.filter((r) => hasTrait(r, prefer)) : [];
  return rng.pick(preferred.length > 0 ? preferred : pool);
}

/** 次の場所の前の出来事を選ぶ（state を直接変える） */
export function rollHappening(state: GameState): void {
  state.pending.happening = null;
  const rng = createPrng(deriveSeed(state.seed, SEED.happening, state.bashoIndex));
  if (!rng.chance(HAPPENING_CHANCE)) return;
  const pool = HAPPENINGS.filter((d) => eligible(state, d));
  const total = pool.reduce((n, d) => n + d.weight, 0);
  if (total <= 0) return;
  let roll = (rng.nextUint32() / 4294967296) * total;
  const def = pool.find((d) => (roll -= d.weight) < 0) ?? pool[pool.length - 1]!;
  state.pending.happening = {
    id: def.id,
    target: def.target ? pickTarget(def.id, targetsOf(state, def.target), rng).id : null,
  };
  state.happeningLog.push({ id: def.id, bashoIndex: state.bashoIndex });
  // 古い記録は捨てる（空ける場所数より前のものは要らない）
  state.happeningLog = state.happeningLog.filter(
    (h) => state.bashoIndex - h.bashoIndex < HAPPENING_COOLDOWN,
  );
}

function applyEffect(
  state: GameState,
  e: HappeningEffect,
  targets: readonly Rikishi[],
  rng: Prng,
): void {
  state.player.stableMoney +=
    (e.stableMoney ?? 0) + (e.perSekitoriMoney ?? 0) * groupOf(state, 'sekitori', null).length;
  state.player.personalMoney += e.personalMoney ?? 0;
  state.player.prestige = Math.max(0, state.player.prestige + (e.prestige ?? 0));
  for (const r of targets) {
    if (e.fatigue) r.fatigue = clamp(r.fatigue + e.fatigue, 0, 100);
    if (e.boost) r.boost = e.boost;
    if (e.weightKg) r.weight += e.weightKg;
    if (e.ability) {
      const style = e.ability.style === 'best' ? styleOf(r.abilities) : e.ability.style;
      r.abilities[style] = clamp(r.abilities[style] + e.ability.amount, 0, 100);
    }
    if (e.fragility) r.fragility *= e.fragility;
    if (e.injury && r.injury > 0) r.injury += e.injury;
    if (e.heal) r.injury = Math.max(0, r.injury - e.heal);
    if (e.injuryRisk && r.injury === 0 && rng.chance(e.injuryRisk)) {
      r.injury = GROWTH.injuryBashoMin;
    }
    if (
      e.retireRequest &&
      rng.chance(e.retireRequest) &&
      !state.pending.retireRequests.includes(r.id)
    ) {
      state.pending.retireRequests.push(r.id);
    }
  }
  if (e.candidate) {
    const master = state.oyakata.find((o) => o.id === state.player.oyakataId)!;
    const used = new Set(state.rikishi.map((r) => r.name));
    const c = makeCandidate(
      rng,
      state.nextId++,
      makeShikona(rng, used, lineageCharOf(master.shikona, rng)),
      0,
      false,
    );
    const { talent, background, foreign } = e.candidate;
    c.talent = rng.range(talent[0], talent[1]);
    c.background = background;
    c.age = background === 'juniorHigh' ? 15 : background === 'highSchool' ? 18 : 22;
    c.foreign = foreign ?? false;
    c.scoutGrade = clamp(Math.round((c.talent - 30) / 14), 1, 5);
    state.pending.candidates.push(c);
  }
}

/**
 * 出来事に答える（option は選択肢の番号。範囲外は最後の選択肢 = 断る）。
 * 選んだ選択肢の鍵と、確率の結果が起きたか（確率のない選択肢は null）を返す
 */
export function applyHappening(
  state: GameState,
  option: number,
): { key: string; hit: boolean | null } | null {
  const h = state.pending.happening;
  if (!h) return null;
  state.pending.happening = null;
  const def = HAPPENINGS.find((d) => d.id === h.id)!;
  const opt = def.options[option] ?? def.options[def.options.length - 1]!;
  const targets = groupOf(state, opt.group, h.target);
  const rng = createPrng(deriveSeed(state.seed, SEED.happening, state.bashoIndex, 1));
  applyEffect(state, opt.effect, targets, rng);
  let hit: boolean | null = null;
  if (opt.chance) {
    hit = rng.chance(opt.chance.p);
    if (hit) applyEffect(state, opt.chance.effect, targets, rng);
  }
  // 部屋の口座がマイナスになったら親方の貯金で埋める
  if (state.player.stableMoney < 0) {
    state.player.personalMoney += state.player.stableMoney;
    state.player.stableMoney = 0;
  }
  return { key: opt.key, hit };
}
