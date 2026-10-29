/**
 * 新弟子: 自分の部屋の入門希望者と、架空の部屋の新弟子
 */
import { RECRUIT } from '../balance/career';
import { GAME } from '../balance/game';
import { makeCandidate, rikishiFromCandidate, styleOf } from '../career/create';
import { lineageCharOf, makeShikona } from '../core/names';
import { createPrng, deriveSeed, SEED } from '../core/prng';
import type { Candidate, GameState, Rikishi } from '../model/types';

const usedNames = (state: GameState) => new Set(state.rikishi.map((r) => r.name));

/** 春場所（3月）の前は中学・高校の卒業で入門希望者が多い */
export function isSpringBasho(bashoIndex: number): boolean {
  return bashoIndex % 6 === 1;
}

/** 次の場所の前に来る入門希望者（state.nextId を進める） */
export function makeCandidates(state: GameState): Candidate[] {
  const rng = createPrng(deriveSeed(state.seed, SEED.recruit, state.bashoIndex, 0));
  const [min, max] = isSpringBasho(state.bashoIndex)
    ? RECRUIT.playerCandidates.spring
    : RECRUIT.playerCandidates.normal;
  // 名声が高いと希望者が増える
  const n =
    rng.range(min, max) +
    Math.min(
      GAME.maxExtraCandidates,
      Math.floor(state.player.prestige / GAME.prestigePerCandidate),
    );
  const master = state.oyakata.find((o) => o.id === state.player.oyakataId)!;
  const used = usedNames(state);
  const hasForeign = state.rikishi.some((r) => r.stableId === state.player.stableId && r.foreign);
  const result: Candidate[] = [];
  for (let i = 0; i < n; i++) {
    const name = makeShikona(
      rng,
      used,
      rng.chance(0.75) ? lineageCharOf(master.shikona, rng) : undefined,
    );
    used.add(name);
    result.push(makeCandidate(rng, state.nextId++, name, state.player.prestige, !hasForeign));
  }
  return result;
}

/** 架空の部屋の新弟子（番付の人数を保つ）。番付の下に足す力士を返す */
export function npcRecruits(state: GameState, count: number): Rikishi[] {
  const rng = createPrng(deriveSeed(state.seed, SEED.recruit, state.bashoIndex, 1));
  const npc = state.stables.filter((s) => !s.isPlayer);
  const used = usedNames(state);
  const foreignIn = new Set(state.rikishi.filter((r) => r.foreign).map((r) => r.stableId));
  const result: Rikishi[] = [];
  for (let i = 0; i < count; i++) {
    const stable = rng.pick(npc);
    const name = makeShikona(rng, used);
    used.add(name);
    const c = makeCandidate(rng, state.nextId++, name, 10, !foreignIn.has(stable.id));
    if (c.foreign) foreignIn.add(stable.id);
    const r = rikishiFromCandidate(c, stable.id, stable.style);
    r.policy = styleOf(r.abilities);
    result.push(r);
  }
  return result;
}
