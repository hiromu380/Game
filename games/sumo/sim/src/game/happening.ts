/**
 * 場所の間の出来事: 次の場所の前に起きる出来事を選び、プレイヤーの答えで効果を出す
 */
import { HAPPENING_CHANCE, HAPPENINGS, type HappeningDef } from '../balance/happenings';
import { GROWTH } from '../balance/growth';
import { isSekitori, ranksOf } from '../banzuke/rank';
import { makeCandidate } from '../career/create';
import { clamp } from '../core/math';
import { lineageCharOf, makeShikona } from '../core/names';
import { createPrng, deriveSeed, SEED } from '../core/prng';
import type { GameState, Rikishi } from '../model/types';

function mine(state: GameState): Rikishi[] {
  return state.rikishi.filter((r) => r.stableId === state.player.stableId);
}

function groupOf(state: GameState, group: 'sekitori' | 'upper' | 'all' | undefined): Rikishi[] {
  const ranks = ranksOf(state.banzuke, state.titles);
  return mine(state).filter((r) => {
    const rank = ranks.get(r.id);
    if (group === 'sekitori') return rank !== undefined && isSekitori(rank);
    if (group === 'upper')
      return rank !== undefined && (isSekitori(rank) || rank.division === 'makushita');
    return group === 'all';
  });
}

function eligible(state: GameState, def: HappeningDef): boolean {
  if (def.requires === 'none') return true;
  if (def.requires === 'injured') return mine(state).some((r) => r.injury > 0);
  return groupOf(state, def.requires).length > 0;
}

/** 次の場所の前の出来事を選ぶ（state を直接変える） */
export function rollHappening(state: GameState): void {
  state.pending.happening = null;
  const rng = createPrng(deriveSeed(state.seed, SEED.happening, state.bashoIndex));
  if (!rng.chance(HAPPENING_CHANCE)) return;
  const pool = HAPPENINGS.filter((d) => eligible(state, d));
  const total = pool.reduce((n, d) => n + d.weight, 0);
  let roll = rng.nextInt(total);
  const def = pool.find((d) => (roll -= d.weight) < 0);
  if (!def) return;
  const injured = mine(state).filter((r) => r.injury > 0);
  state.pending.happening = {
    id: def.id,
    target: def.requires === 'injured' ? rng.pick(injured).id : null,
  };
}

/** 出来事に答える（option は選択肢の番号。最後の選択肢が「断る」） */
export function applyHappening(state: GameState, option: number): string | null {
  const h = state.pending.happening;
  if (!h) return null;
  state.pending.happening = null;
  const def = HAPPENINGS.find((d) => d.id === h.id)!;
  const opt = def.options[option] ?? def.options[def.options.length - 1]!;
  const e = opt.effect;
  const targets = groupOf(state, opt.group);
  const rng = createPrng(deriveSeed(state.seed, SEED.happening, state.bashoIndex, 1));
  state.player.stableMoney +=
    (e.stableMoney ?? 0) + (e.perSekitoriMoney ?? 0) * groupOf(state, 'sekitori').length;
  state.player.prestige = Math.max(0, state.player.prestige + (e.prestige ?? 0));
  for (const r of targets) {
    if (e.fatigue) r.fatigue = clamp(r.fatigue + e.fatigue, 0, 100);
    if (e.boost) r.boost = e.boost;
    if (e.injuryRisk && r.injury === 0 && rng.chance(e.injuryRisk)) {
      r.injury = GROWTH.injuryBashoMin;
    }
  }
  if (e.heal && h.target !== null) {
    const r = state.rikishi.find((x) => x.id === h.target);
    if (r) r.injury = Math.max(0, r.injury - e.heal);
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
    c.talent = rng.range(e.candidate[0], e.candidate[1]);
    c.background = 'juniorHigh';
    c.age = 15;
    c.scoutGrade = clamp(Math.round((c.talent - 30) / 14), 1, 5);
    state.pending.candidates.push(c);
  }
  // 部屋の口座がマイナスになったら親方の貯金で埋める
  if (state.player.stableMoney < 0) {
    state.player.personalMoney += state.player.stableMoney;
    state.player.stableMoney = 0;
  }
  return opt.key;
}
