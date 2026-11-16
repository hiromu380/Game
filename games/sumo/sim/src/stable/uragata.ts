/**
 * 裏方（行司・呼出・床山）を部屋に迎える: その役がいない部屋に、ときどき志望者が来る。迎えるかは親方が決める（返事がなければ見送る）。
 * 給料は協会が払うので、部屋の口座は動かない。定年で去る
 */
import { URAGATA, URAGATA_ROLES, type UragataRole } from '../balance/uragata';
import { makeUragataName } from '../core/names';
import { createPrng, deriveSeed, SEED } from '../core/prng';
import { note } from '../game/journal';
import type { GameState } from '../model/types';

export function uragataOf(state: GameState, role: UragataRole) {
  return (state.player.uragata ?? []).find((u) => u.role === role);
}

/** 場所の後: いない役に志望者が来ることがある（乱数は用途別の流れ） */
export function rollUragata(state: GameState): void {
  state.pending.uragata = null;
  const deshi = state.rikishi.filter((r) => r.stableId === state.player.stableId).length;
  if (deshi < URAGATA.minDeshi) return;
  const rng = createPrng(deriveSeed(state.seed, SEED.uragata, state.bashoIndex));
  const missing = URAGATA_ROLES.filter((role) => !uragataOf(state, role));
  if (missing.length === 0 || !rng.chance(URAGATA.applyChance)) return;
  const role = rng.pick(missing);
  const used = new Set((state.player.uragata ?? []).map((u) => u.name));
  state.pending.uragata = {
    role,
    name: makeUragataName(rng, role, used),
    age: rng.range(URAGATA.age[0], URAGATA.age[1]),
  };
}

/** 志望者を迎える・見送る */
export function answerUragata(input: GameState, accept: boolean): GameState {
  const a = input.pending.uragata;
  if (!a) return input;
  const state: GameState = JSON.parse(JSON.stringify(input));
  state.pending.uragata = null;
  if (!accept) return state;
  state.player.uragata = [...(state.player.uragata ?? []), { ...a, since: state.bashoIndex }];
  note(state, { kind: 'uragata', role: a.role, name: a.name, event: 'join' });
  return state;
}

/** 年の終わり: 年をとり、定年で去る */
export function ageUragata(state: GameState): void {
  const list = state.player.uragata ?? [];
  for (const u of list) u.age++;
  for (const u of list.filter((x) => x.age >= URAGATA.retireAge))
    note(state, { kind: 'uragata', role: u.role, name: u.name, event: 'retire' });
  state.player.uragata = list.filter((x) => x.age < URAGATA.retireAge);
}

/** 稽古と名声への効き目 */
export function uragataEffect(state: GameState): {
  sekitoriRecovery: number;
  injury: number;
  prestige: number;
} {
  return {
    sekitoriRecovery: uragataOf(state, 'tokoyama') ? URAGATA.tokoyamaRecovery : 0,
    injury: uragataOf(state, 'yobidashi') ? URAGATA.yobidashiInjury : 1,
    prestige: uragataOf(state, 'gyoji') ? URAGATA.gyojiPrestige : 0,
  };
}
