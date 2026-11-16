/**
 * よその部屋付きの親方を迎える: 同じ一門の、部屋付きの親方が2人以上いる部屋から1人を移籍で迎える。
 * 稽古を見る人が増える（部屋付きの親方の数が稽古の伸びに効く）。何場所かに1回まで
 */
import { HEYATSUKI } from '../balance/heyatsuki';
import { note } from '../game/journal';
import type { GameState, Oyakata } from '../model/types';

const heyatsukiOf = (state: GameState, stableId: number) =>
  state.oyakata.filter((o) => o.stableId === stableId && o.role === 'heyatsuki');

/** 迎えられる親方（いま迎えられなければ空） */
export function heyatsukiOffers(state: GameState): Oyakata[] {
  if (heyatsukiOf(state, state.player.stableId).length >= HEYATSUKI.max) return [];
  const last = state.player.lastInvite;
  if (last !== undefined && state.bashoIndex - last < HEYATSUKI.cooldown) return [];
  const mine = state.stables.find((s) => s.id === state.player.stableId);
  if (!mine) return [];
  const out: Oyakata[] = [];
  for (const s of state.stables) {
    if (s.id === mine.id || s.ichimonId !== mine.ichimonId) continue;
    const list = heyatsukiOf(state, s.id);
    if (list.length > HEYATSUKI.keepAtSource) out.push(...list.slice(HEYATSUKI.keepAtSource));
  }
  return out.sort((a, b) => a.age - b.age || a.id - b.id);
}

/** 迎える */
export function inviteHeyatsuki(input: GameState, oyakataId: number): GameState {
  if (!heyatsukiOffers(input).some((o) => o.id === oyakataId)) return input;
  const state: GameState = JSON.parse(JSON.stringify(input));
  const o = state.oyakata.find((x) => x.id === oyakataId)!;
  const from = state.stables.find((s) => s.id === o.stableId)?.name ?? '';
  o.stableId = state.player.stableId;
  o.since = state.bashoIndex;
  state.player.lastInvite = state.bashoIndex;
  note(state, { kind: 'heyatsukiJoin', name: o.name, shikona: o.shikona, from });
  return state;
}
