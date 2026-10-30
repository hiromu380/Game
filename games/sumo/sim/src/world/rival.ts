/**
 * ライバルの部屋: 同期（年の近い）親方の、別の一門の部屋。直接対決と、有望な新弟子の取り合い
 */
import { RIVAL } from '../balance/rival';
import { isSekitori } from '../banzuke/rank';
import { rikishiFromCandidate } from '../career/create';
import { note } from '../game/journal';
import type { BashoReport, BoutResult, GameState, Rank } from '../model/types';
import { masterOf } from './association';

/** ライバルを選ぶ（いない・部屋が閉じたとき）。師匠の年が近い、別の一門の架空の部屋 */
export function ensureRival(state: GameState): void {
  if (state.rival && state.stables.some((s) => s.id === state.rival!.stableId)) return;
  const me = state.stables.find((s) => s.id === state.player.stableId)!;
  const myMaster = state.oyakata.find((o) => o.id === state.player.oyakataId)!;
  const pool = state.stables
    .filter((s) => !s.isPlayer && !s.branch && s.ichimonId !== me.ichimonId)
    .map((s) => ({ s, m: masterOf(state, s.id) }))
    .filter((x) => x.m !== undefined)
    .sort(
      (a, b) =>
        Math.abs(a.m!.age - myMaster.age) - Math.abs(b.m!.age - myMaster.age) || a.s.id - b.s.id,
    );
  const pick = pool[0]?.s;
  state.rival = pick ? { stableId: pick.id, wins: 0, losses: 0, since: state.bashoIndex } : null;
  if (pick) note(state, { kind: 'rival', event: 'new', stable: pick.name });
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
