/**
 * 新十両の化粧まわしと明け荷: 新しく関取になった自分の弟子の化粧まわしを、タニマチに頼む・部屋で作る・師匠のを借りる、から選ぶ。
 * 明け荷は同期生（同じ場所に初土俵を踏んだ力士）が贈る習わし（乱数を使わない）
 */
import { KESHO, type KeshoFrom } from '../balance/kesho';
import { note } from '../game/journal';
import { canAfford, pay } from '../money/pay';
import type { GameState, Rikishi } from '../model/types';

/** 番付に初めて載った場所（番付に載った場所数から逆算） */
export function joinedAt(state: Pick<GameState, 'bashoIndex'>, r: Pick<Rikishi, 'career'>): number {
  return state.bashoIndex - r.career.basho;
}

/** 今も土俵にいる同期生の数（どの部屋も。本人は数えない） */
export function dokiOf(state: Pick<GameState, 'bashoIndex' | 'rikishi'>, id: number): number {
  const r = state.rikishi.find((x) => x.id === id);
  if (!r) return 0;
  const at = joinedAt(state, r);
  return state.rikishi.filter((x) => x.id !== id && x.career.basho > 0 && joinedAt(state, x) === at)
    .length;
}

/** いちばん関係の深い、化粧まわしを頼めるタニマチ（いなければ null） */
export function keshoPatron(state: GameState) {
  return (
    [...state.player.koenkai.patrons]
      .filter((p) => p.favor >= KESHO.patronFavor)
      .sort((a, b) => b.favor - a.favor || a.id - b.id)[0] ?? null
  );
}

/** 選べる手配 */
export function keshoOptions(state: GameState): KeshoFrom[] {
  const out: KeshoFrom[] = [];
  if (keshoPatron(state)) out.push('patron');
  if (canAfford(state, KESHO.cost)) out.push('stable');
  out.push('borrowed');
  return out;
}

/** 新しい関取が出たとき（場所の後）: 化粧まわしを聞き、同期生から明け荷が届く */
export function onNewSekitori(state: GameState, r: Rikishi): void {
  if (!state.pending.kesho.includes(r.id)) state.pending.kesho.push(r.id);
  note(state, { kind: 'akeni', shikona: r.name, doki: dokiOf(state, r.id) });
}

/** 化粧まわしの手配を決める */
export function answerKesho(input: GameState, id: number, from: KeshoFrom): GameState {
  if (!input.pending.kesho.includes(id)) return input;
  if (!keshoOptions(input).includes(from)) return input;
  const state: GameState = JSON.parse(JSON.stringify(input));
  setKesho(state, id, from);
  return state;
}

/** 手配を決めて記録する（返事がなければ借りる） */
export function setKesho(state: GameState, id: number, from: KeshoFrom): void {
  state.pending.kesho = state.pending.kesho.filter((x) => x !== id);
  const r = state.rikishi.find((x) => x.id === id);
  if (!r) return;
  let by: string | undefined;
  if (from === 'patron') {
    const p = keshoPatron(state)!;
    p.favoriteId = id;
    p.favor = Math.min(100, p.favor + KESHO.patronFavorGain);
    by = p.surname;
  } else if (from === 'stable') {
    pay(state, KESHO.cost);
    state.player.prestige += KESHO.stablePrestige;
    const k = state.player.koenkai;
    k.members = Math.round(k.members * (1 + KESHO.stableMembers));
  }
  r.kesho = by ? { from, by } : { from };
  note(state, { kind: 'kesho', shikona: r.name, from, ...(by ? { by } : {}) });
}
