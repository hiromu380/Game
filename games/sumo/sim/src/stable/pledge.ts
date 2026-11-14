/**
 * 後援会との約束: 年の初めに選び、場所ごとに進み具合を数え、年の終わりに果たせたかを決める（乱数を使わない）
 */
import { DIVISIONS } from '../balance/banzuke';
import { KACHIKOSHI_SHARE, PLEDGE_KINDS, PLEDGES, type PledgeKind } from '../balance/pledge';
import { ranksOf } from '../banzuke/rank';
import type { BashoReport, GameState, Rank } from '../model/types';
import { note } from '../game/journal';

/** いちばん上の弟子の高さ（小さいほど上: 三役 −1・幕内 0・十両 1 … 序ノ口 5。弟子がいなければ 6） */
export function bestHeight(
  state: Pick<GameState, 'rikishi' | 'player'>,
  ranks: ReadonlyMap<number, Rank>,
): number {
  let best = DIVISIONS.length;
  for (const r of state.rikishi) {
    if (r.stableId !== state.player.stableId) continue;
    const k = ranks.get(r.id);
    if (!k) continue;
    const h = k.title && k.title !== 'M' ? -1 : DIVISIONS.indexOf(k.division);
    if (h < best) best = h;
  }
  return best;
}

/** 年の初めに選べる約束（いちばん上が三役以上なら「上の段へ」は出さない） */
export function pledgeOffers(
  state: Pick<GameState, 'rikishi' | 'player'>,
  ranks: ReadonlyMap<number, Rank>,
): PledgeKind[] {
  const has = state.rikishi.some((r) => r.stableId === state.player.stableId);
  if (!has) return [];
  return PLEDGE_KINDS.filter((k) => k !== 'division' || bestHeight(state, ranks) > -1);
}

/** 約束する（null なら約束しない）。支度金が先に部屋の口座に入る */
export function answerPledge(input: GameState, kind: PledgeKind | null): GameState {
  if (!input.pending.pledge) return input;
  if (kind !== null && !input.pending.pledge.includes(kind)) return input;
  const state: GameState = JSON.parse(JSON.stringify(input));
  state.pending.pledge = null;
  if (kind === null) return state;
  state.player.stableMoney += PLEDGES[kind].advance;
  state.player.pledge = {
    kind,
    since: state.bashoIndex,
    kk: 0,
    mk: 0,
    baseline: bestHeight(state, ranksOf(state.banzuke, state.titles)),
    done: false,
  };
  note(state, { kind: 'pledge', pledge: kind, result: 'made' });
  return state;
}

/** 場所の後: 約束の進み具合を数える（勝ち越しと負け越し・上の段に届いたか・新十両が出たか） */
export function trackPledge(
  state: GameState,
  report: BashoReport,
  ranks: ReadonlyMap<number, Rank>,
): void {
  const p = state.player.pledge;
  if (!p) return;
  for (const m of report.mine) {
    const r = m.record;
    if (r.wins > r.losses + r.absences) p.kk++;
    else p.mk++;
  }
  if (p.kind === 'division' && bestHeight(state, ranks) < p.baseline) p.done = true;
  if (p.kind === 'sekitori') {
    const mine = new Set(
      state.rikishi.filter((r) => r.stableId === state.player.stableId).map((r) => r.id),
    );
    if (report.promotions.some((x) => x.to === 'sekitori' && mine.has(x.id))) p.done = true;
  }
}

/** 約束が今のところ果たせているか */
export function pledgeKept(p: NonNullable<GameState['player']['pledge']>): boolean {
  return p.kind === 'kachikoshi'
    ? p.kk + p.mk > 0 && p.kk >= KACHIKOSHI_SHARE * (p.kk + p.mk)
    : p.done;
}

/** 年の終わり: 約束を果たせたかを決め、名声・会員・タニマチの関係を動かす。破れば支度金を返す（口座が足りなければ、次の精算で貯金から埋まる） */
export function settlePledge(state: GameState, report: BashoReport): void {
  const p = state.player.pledge;
  if (!p) return;
  const def = PLEDGES[p.kind];
  const kept = pledgeKept(p);
  if (kept) {
    state.player.prestige += def.prestige;
  } else {
    state.player.prestige = Math.max(0, state.player.prestige - def.failPrestige);
    state.player.stableMoney -= Math.round(def.advance * def.failRepay);
    const k = state.player.koenkai;
    k.members = Math.round(k.members * (1 - def.failMembers));
    for (const x of k.patrons) x.favor = Math.max(0, x.favor - def.failFavor);
  }
  report.pledge = { kind: p.kind, kept };
  note(state, { kind: 'pledge', pledge: p.kind, result: kept ? 'kept' : 'broken' });
  state.player.pledge = null;
}
