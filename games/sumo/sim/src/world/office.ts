/**
 * 協会の役職と理事選挙
 *
 * - 自分の親方の役職は、年齢と名声で年の終わりに上がる（委員まで・役員待遇委員）
 * - 理事選挙は2年に1度。一門ごとの議席を親方の数で割り振り（ドント式）、各一門は格の高い親方を推薦する。
 *   推薦があれば立候補で当選（無投票）。推薦がなくても立候補できる（造反）が、当選は名声しだいの賭け
 * - 理事長は、理事のうちいちばん格の高い親方
 */
import { OFFICE, OFFICE_ORDER } from '../balance/office';
import { isSekitori, rankValue, ranksOf } from '../banzuke/rank';
import { createPrng, deriveSeed, SEED } from '../core/prng';
import { note } from '../game/journal';
import type { AssocRank, GameState, Oyakata } from '../model/types';

export const officeAtLeast = (a: AssocRank, b: AssocRank) =>
  OFFICE_ORDER.indexOf(a) >= OFFICE_ORDER.indexOf(b);

const ELECTED: readonly AssocRank[] = ['fukuRiji', 'riji', 'rijicho'];
export const isBoardMember = (r: AssocRank) => ELECTED.includes(r);

/** 代替わり・開始のときの役職（年齢から） */
export function initialOffice(age: number): AssocRank {
  return age >= OFFICE.iinAge ? 'iin' : age >= OFFICE.shuninAge ? 'shunin' : 'toshiyori';
}

/** 年の終わり: 自分の親方の役職が上がる（選挙で決まる役職は除く） */
export function yearEndOffice(state: GameState): void {
  const o = state.oyakata.find((x) => x.id === state.player.oyakataId);
  if (!o) return;
  const office = state.player.office;
  const prestige = state.player.prestige;
  let next: AssocRank | null = null;
  if (office.rank === 'toshiyori' && o.age >= OFFICE.shuninAge) next = 'shunin';
  else if (
    office.rank === 'shunin' &&
    (o.age >= OFFICE.iinAge || (o.age >= OFFICE.iinPrestigeAge && prestige >= OFFICE.iinPrestige))
  )
    next = 'iin';
  else if (
    office.rank === 'iin' &&
    state.bashoIndex - office.since >= OFFICE.taiguuYears * 6 &&
    prestige >= OFFICE.taiguuPrestige
  )
    next = 'yakuinTaiguu';
  if (next) {
    state.player.office = { rank: next, since: state.bashoIndex };
    note(state, { kind: 'office', rank: next });
  }
}

/**
 * 理事候補としての格: 年齢より実績（現役時代の地位・師匠として育てた関取）を重く見る。
 * 自分の親方は部屋の名声も数える。いまの役職は数えない（一度上がると上がり続けないように）
 */
function standing(state: GameState, o: Oyakata, sekitoriOf: Map<number, number>): number {
  const top = o.highestRank ? rankValue(o.highestRank) : 10_000;
  const w = OFFICE.standing;
  const rankBonus =
    top < 2 ? w.yokozuna : top < 6 ? w.ozeki : top < 12 ? w.sanyaku : top < 100 ? w.makuuchi : 0;
  const isMe = o.id === state.player.oyakataId;
  return (
    o.age * w.perAge +
    rankBonus +
    (o.role === 'master' ? (sekitoriOf.get(o.stableId) ?? 0) * w.perSekitori : 0) +
    (isMe ? state.player.prestige * w.perPrestige : 0)
  );
}

interface Slate {
  riji: number[];
  fukuRiji: number[];
  /** 一門ごとの候補（格の高い順） */
  byIchimon: Map<number, Oyakata[]>;
  score: Map<number, number>;
}

/** 一門ごとの議席と推薦の顔ぶれ */
function slate(state: GameState): Slate {
  const ranks = ranksOf(state.banzuke, state.titles);
  const sekitoriOf = new Map<number, number>();
  for (const r of state.rikishi) {
    const rank = ranks.get(r.id);
    if (rank && isSekitori(rank)) sekitoriOf.set(r.stableId, (sekitoriOf.get(r.stableId) ?? 0) + 1);
  }
  const ichimonOf = new Map(state.stables.map((s) => [s.id, s.ichimonId]));
  const voters = new Map<number, number>();
  const byIchimon = new Map<number, Oyakata[]>();
  const score = new Map<number, number>();
  const me = state.player.oyakataId;
  for (const o of state.oyakata) {
    if (o.role === 'sanyo' || o.role === 'waiting') continue;
    const ich = ichimonOf.get(o.stableId);
    if (ich === undefined) continue;
    voters.set(ich, (voters.get(ich) ?? 0) + 1);
    // 任期中に定年にならない親方。自分の親方は委員以上でないと推薦されない
    if (o.age > 62) continue;
    if (o.id === me && !officeAtLeast(state.player.office.rank, OFFICE.candidateFrom)) continue;
    score.set(o.id, standing(state, o, sekitoriOf));
    byIchimon.set(ich, [...(byIchimon.get(ich) ?? []), o]);
  }
  for (const list of byIchimon.values())
    list.sort((a, b) => score.get(b.id)! - score.get(a.id)! || a.id - b.id);
  // ドント式で13議席。先の10が理事、後の3が副理事
  const seats: number[] = [];
  const won = new Map<number, number>();
  for (let i = 0; i < OFFICE.rijiSeats + OFFICE.fukuRijiSeats; i++) {
    let best = -1;
    let bestQ = -1;
    for (const [ich, v] of [...voters].sort((a, b) => a[0] - b[0])) {
      const available = (byIchimon.get(ich)?.length ?? 0) - (won.get(ich) ?? 0);
      if (available <= 0) continue;
      const q = v / ((won.get(ich) ?? 0) + 1);
      if (q > bestQ) {
        bestQ = q;
        best = ich;
      }
    }
    if (best < 0) break;
    seats.push(best);
    won.set(best, (won.get(best) ?? 0) + 1);
  }
  const used = new Map<number, number>();
  const take = (ich: number) => {
    const k = used.get(ich) ?? 0;
    used.set(ich, k + 1);
    return byIchimon.get(ich)![k]!.id;
  };
  const picks = seats.map(take);
  return {
    riji: picks.slice(0, OFFICE.rijiSeats),
    fukuRiji: picks.slice(OFFICE.rijiSeats),
    byIchimon,
    score,
  };
}

/** 選挙の前の場所: 一門の推薦があるかを知らせる */
export function scheduleElection(state: GameState): void {
  if (state.bashoIndex === 0 || state.bashoIndex % OFFICE.electionEveryBasho !== 0) return;
  const s = slate(state);
  const me = state.player.oyakataId;
  const recommended = s.riji.includes(me) ? 'riji' : s.fukuRiji.includes(me) ? 'fukuRiji' : null;
  // 委員より下なら立候補できない（返事はいらない）
  const eligible = officeAtLeast(state.player.office.rank, OFFICE.candidateFrom);
  state.pending.election = { recommended, choice: eligible ? null : 'stay' };
}

/** 場所の後: 理事選挙を行い、理事会と自分の役職を決める */
export function holdElection(state: GameState): void {
  const e = state.pending.election;
  if (!e) return;
  state.pending.election = null;
  const s = slate(state);
  const me = state.player.oyakataId;
  const myIchimon = state.stables.find((x) => x.id === state.player.stableId)!.ichimonId;
  const choice = e.choice ?? (e.recommended ? 'run' : 'stay');
  let riji = [...s.riji];
  let fukuRiji = [...s.fukuRiji];
  let rebel = false;
  if (choice === 'stay' && (riji.includes(me) || fukuRiji.includes(me))) {
    // 推薦を辞退: 一門の次の親方が入る
    const next = (s.byIchimon.get(myIchimon) ?? []).find(
      (o) => o.id !== me && !riji.includes(o.id) && !fukuRiji.includes(o.id),
    );
    riji = riji.map((id) => (id === me ? (next?.id ?? id) : id)).filter((id) => id !== me);
    fukuRiji = fukuRiji.map((id) => (id === me ? (next?.id ?? id) : id)).filter((id) => id !== me);
  } else if (choice === 'run' && !riji.includes(me) && !fukuRiji.includes(me)) {
    // 造反: 一門の推薦なしで立候補。投票になり、当選すれば理事の最後の席を奪う
    rebel = true;
    const rng = createPrng(deriveSeed(state.seed, SEED.office, state.bashoIndex));
    const p = Math.min(
      OFFICE.rebelMax,
      OFFICE.rebelBase + state.player.prestige * OFFICE.rebelPerPrestige,
    );
    const won = rng.chance(p);
    if (won) riji = [...riji.slice(0, -1), me];
    state.player.prestige = Math.max(
      0,
      state.player.prestige + (won ? OFFICE.rebelWinPrestige : OFFICE.rebelLosePrestige),
    );
  }
  // 理事長: 前の期から続けて理事の親方のうち、いちばん格の高い親方（はじめての選挙は理事全員から）
  const scoreOf = (id: number) => s.score.get(id) ?? 0;
  const before = state.board;
  const veterans = before ? riji.filter((id) => before.riji.includes(id)) : riji;
  const rijicho =
    [...(veterans.length > 0 ? veterans : riji)].sort(
      (a, b) => scoreOf(b) - scoreOf(a) || a - b,
    )[0] ?? null;
  state.board = { electedAt: state.bashoIndex, riji, fukuRiji, rijicho };

  const prev = state.player.office.rank;
  const now: AssocRank =
    rijicho === me
      ? 'rijicho'
      : riji.includes(me)
        ? 'riji'
        : fukuRiji.includes(me)
          ? 'fukuRiji'
          : isBoardMember(prev)
            ? 'yakuinTaiguu'
            : prev;
  if (now !== prev) state.player.office = { rank: now, since: state.bashoIndex };
  const elected = isBoardMember(now);
  if (choice === 'run' || elected || isBoardMember(prev)) {
    note(state, {
      kind: 'election',
      result: elected ? 'elected' : choice === 'run' ? 'lost' : 'stayed',
      rank: now,
      rebel,
      uncontested: !rebel,
    });
  }
}
