/**
 * ライバルの部屋: 同期（年の近い）親方で、番付の力が近い、別の一門の部屋。直接対決と、有望な新弟子の取り合い
 */
import { RIVAL } from '../balance/rival';
import { isSanyaku, isSekitori, ranksOf } from '../banzuke/rank';
import { rikishiFromCandidate } from '../career/create';
import { note } from '../game/journal';
import type { BashoReport, BoutResult, GameState, Rank } from '../model/types';
import { masterOf } from './association';

/** 部屋の力: 番付に載った弟子の地位ごとの点の合計（ライバル選びの目安） */
export function stableStrength(state: GameState, stableId: number): number {
  const ranks = ranksOf(state.banzuke, state.titles);
  const p = RIVAL.strengthPoints;
  let sum = 0;
  for (const r of state.rikishi) {
    if (r.stableId !== stableId) continue;
    const rank = ranks.get(r.id);
    if (!rank) continue;
    if (rank.title === 'Y') sum += p.Y;
    else if (rank.title === 'O') sum += p.O;
    else if (isSanyaku(rank)) sum += p.sanyaku;
    else if (rank.division === 'makuuchi') sum += p.makuuchi;
    else if (rank.division === 'juryo') sum += p.juryo;
    else if (rank.division === 'makushita') sum += p.makushita;
    else if (rank.division === 'sandanme') sum += p.sandanme;
    else sum += p.lower;
  }
  return sum;
}

/** ライバルの候補（別の一門の架空の本家の部屋）を、合う順に並べる（小さいほど合う） */
function rivalCandidates(state: GameState): { id: number; name: string; cost: number }[] {
  const me = state.stables.find((s) => s.id === state.player.stableId)!;
  const myMaster = state.oyakata.find((o) => o.id === state.player.oyakataId)!;
  const mine = stableStrength(state, me.id);
  const c = RIVAL.choose;
  return state.stables
    .filter((s) => !s.isPlayer && !s.branch && s.ichimonId !== me.ichimonId)
    .map((s) => ({ s, m: masterOf(state, s.id) }))
    .filter((x) => x.m !== undefined)
    .map(({ s, m }) => {
      const theirs = stableStrength(state, s.id);
      const age = Math.min(1, Math.abs(m!.age - myMaster.age) / c.ageScale);
      const strength = Math.abs(theirs - mine) / (Math.max(theirs, mine) + c.strengthFloor);
      return { id: s.id, name: s.name, cost: c.age * age + c.strength * strength };
    })
    .sort((a, b) => a.cost - b.cost || a.id - b.id);
}

/**
 * ライバルを選ぶ: いない・部屋が閉じたとき。師匠の年が近く、部屋の力（番付）が近い、別の一門の部屋。
 * review（年の終わり）: ライバルになって何年かたち、もっと競る部屋が出てきたら替わる
 */
export function ensureRival(state: GameState, review = false): void {
  const current = state.rival && state.stables.find((s) => s.id === state.rival!.stableId);
  if (current && !review) return;
  const pool = rivalCandidates(state);
  const best = pool[0];
  if (current) {
    if (state.bashoIndex - state.rival!.since < RIVAL.reviewAfterYears * 6) return;
    const now = pool.find((x) => x.id === current.id);
    if (!best || best.id === current.id) return;
    if (now && now.cost - best.cost <= RIVAL.switchMargin) return;
    state.rival = { stableId: best.id, wins: 0, losses: 0, since: state.bashoIndex };
    note(state, { kind: 'rival', event: 'switch', stable: best.name, from: current.name });
    return;
  }
  state.rival = best ? { stableId: best.id, wins: 0, losses: 0, since: state.bashoIndex } : null;
  if (best) note(state, { kind: 'rival', event: 'new', stable: best.name });
}

/** 返事をしなかった取り合いの新弟子は、ライバルの部屋に入る */
export function rivalSignsCandidates(state: GameState): void {
  const rival = state.rival && state.stables.find((s) => s.id === state.rival!.stableId);
  if (!rival) return;
  for (const c of state.pending.candidates.filter((x) => x.contested)) {
    const m = masterOf(state, rival.id);
    state.rikishi.push(rikishiFromCandidate(c, rival.id, m?.style ?? rival.style));
    note(state, { kind: 'rival', event: 'signed', stable: rival.name, shikona: c.name });
  }
}

/** 場所の後: 直接対決を数え、ライバルの大きな出来事を日誌に残す */
export function settleRival(
  state: GameState,
  bouts: readonly BoutResult[],
  report: BashoReport,
  newRanks: ReadonlyMap<number, Rank>,
  rankBefore: ReadonlyMap<number, Rank>,
): void {
  const rival = state.rival && state.stables.find((s) => s.id === state.rival!.stableId);
  if (!state.rival || !rival) return;
  const stableOf = new Map(state.rikishi.map((r) => [r.id, r.stableId]));
  const nameOf = new Map(state.rikishi.map((r) => [r.id, r.name]));
  const mine = state.player.stableId;
  let wins = 0;
  let losses = 0;
  for (const b of bouts) {
    const e = stableOf.get(b.eastId);
    const w = stableOf.get(b.westId);
    const myId =
      e === mine && w === rival.id ? b.eastId : w === mine && e === rival.id ? b.westId : null;
    if (myId === null) continue;
    if (b.winnerId === myId) {
      wins++;
      const rank = rankBefore.get(myId);
      if (rank && isSekitori(rank)) state.player.prestige += RIVAL.prestigePerWin;
    } else losses++;
  }
  state.rival.wins += wins;
  state.rival.losses += losses;
  const sekitori = (stableId: number) =>
    state.rikishi.filter(
      (r) => r.stableId === stableId && newRanks.has(r.id) && isSekitori(newRanks.get(r.id)!),
    ).length;
  report.rival = {
    stableId: rival.id,
    wins,
    losses,
    sekitori: [sekitori(mine), sekitori(rival.id)],
  };
  const y = report.yusho.makuuchi;
  if (y !== undefined && stableOf.get(y) === rival.id)
    note(state, {
      kind: 'rival',
      event: 'yusho',
      stable: rival.name,
      shikona: nameOf.get(y) ?? '',
    });
  for (const p of report.promotions) {
    if ((p.to === 'O' || p.to === 'Y') && stableOf.get(p.id) === rival.id)
      note(state, {
        kind: 'rival',
        event: p.to,
        stable: rival.name,
        shikona: nameOf.get(p.id) ?? '',
      });
  }
}
