/**
 * 部屋の役目（純粋関数。乱数を使わない）: 関取に付け人を付け、残りの幕下以下でちゃんこ番を持ち回る。
 * - 付け人: 関取の地位で人数が決まる。番付の上の弟子から（三段目・幕下は関取の稽古相手になる）。雑用を免除した弟子は付けない
 * - ちゃんこ番: 付け人でない幕下以下。幕下15枚目以内と、親方が雑用を免除した弟子は外れる
 * 足りない付け人は、同じ一門の部屋から借りる（見せるだけ）
 */
import { ROLES } from '../balance/roles';
import { isSekitori, ranksOf } from '../banzuke/rank';
import type { GameState, Rank, Rikishi } from '../model/types';

export type Role = 'sekitori' | 'tsukebito' | 'chankoban' | 'upper' | 'exempt' | 'injured';

export interface StableRoles {
  of: Map<number, Role>;
  /** 付け人 → 世話をする関取 */
  serves: Map<number, number>;
  /** 関取 → 付け人（部屋の弟子） */
  attendants: Map<number, number[]>;
  /** 関取 → 足りない付け人の数（一門から借りる） */
  short: Map<number, number>;
  /** ちゃんこ番1人あたりの受け持ち（0〜1。持ち回りの人数で割る） */
  chankoLoad: number;
  /** ちゃんこ番がひとりもいない */
  noCook: boolean;
}

/** 関取の付け人の人数 */
export function tsukebitoNeeded(rank: Rank): number {
  if (rank.title === 'Y') return ROLES.tsukebito.Y;
  if (rank.title === 'O') return ROLES.tsukebito.O;
  return rank.division === 'makuuchi' ? ROLES.tsukebito.makuuchi : ROLES.tsukebito.juryo;
}

export function stableRoles(
  state: Pick<GameState, 'rikishi' | 'player' | 'banzuke' | 'titles'>,
  ranks: ReadonlyMap<number, Rank> = ranksOf(state.banzuke, state.titles),
): StableRoles {
  const order = new Map(state.banzuke.map((id, i) => [id, i]));
  const exempt = new Set(state.player.exempt ?? []);
  const mine = state.rikishi
    .filter((r) => r.stableId === state.player.stableId)
    .sort((a, b) => (order.get(a.id) ?? 1e9) - (order.get(b.id) ?? 1e9) || a.id - b.id);
  const of = new Map<number, Role>();
  const serves = new Map<number, number>();
  const attendants = new Map<number, number[]>();
  const short = new Map<number, number>();
  const sekitori = mine.filter((r) => {
    const k = ranks.get(r.id);
    return k !== undefined && isSekitori(k);
  });
  for (const r of sekitori) of.set(r.id, 'sekitori');
  // 付け人になれる弟子（けがのない幕下以下。免除した弟子は付けない）。番付の上から
  const pool = mine.filter((r) => !of.has(r.id) && r.injury === 0 && !exempt.has(r.id));
  for (const s of sekitori) {
    const need = tsukebitoNeeded(ranks.get(s.id)!);
    const got = pool.filter((r) => !serves.has(r.id)).slice(0, need);
    for (const r of got) {
      serves.set(r.id, s.id);
      of.set(r.id, 'tsukebito');
    }
    attendants.set(
      s.id,
      got.map((r) => r.id),
    );
    if (got.length < need) short.set(s.id, need - got.length);
  }
  // 残りの幕下以下
  const cooks: number[] = [];
  for (const r of mine) {
    if (of.has(r.id)) continue;
    const k = ranks.get(r.id);
    if (r.injury > 0) of.set(r.id, 'injured');
    else if (exempt.has(r.id)) of.set(r.id, 'exempt');
    else if (k && k.division === 'makushita' && k.number <= ROLES.chankoExemptWithin)
      of.set(r.id, 'upper');
    else {
      of.set(r.id, 'chankoban');
      cooks.push(r.id);
    }
  }
  return {
    of,
    serves,
    attendants,
    short,
    chankoLoad: cooks.length > 0 ? Math.min(1, ROLES.chankoCooks / cooks.length) : 0,
    noCook: cooks.length === 0 && mine.length > 0,
  };
}

/** 雑用（付け人・ちゃんこ番）を免除する・戻す（関取は対象外） */
export function setExempt(input: GameState, id: number, on: boolean): GameState {
  const r = input.rikishi.find((x) => x.id === id);
  if (!r || r.stableId !== input.player.stableId) return input;
  const list = input.player.exempt ?? [];
  if (on === list.includes(id)) return input;
  const state: GameState = JSON.parse(JSON.stringify(input));
  state.player.exempt = on ? [...list, id] : list.filter((x) => x !== id);
  return state;
}

/** 相撲教習所に通っている（入門から半年。番付に載った場所数で数える） */
export function inKyoshujo(r: Pick<Rikishi, 'career'>): boolean {
  return r.career.basho < ROLES.kyoshujoBasho;
}

/** 役目による稽古の効き目: 伸びの倍率と、疲れの増え（マイナスは抜ける）。教習所に通う弟子は伸びが少しよい */
export function roleEffect(
  roles: StableRoles,
  id: number,
  r?: Pick<Rikishi, 'career'>,
): { growth: number; fatigue: number } {
  const role = roles.of.get(id);
  let growth = r && inKyoshujo(r) ? ROLES.kyoshujoGrowth : 1;
  let fatigue = roles.noCook ? ROLES.noCookFatigue : 0;
  if (role === 'tsukebito') {
    growth *= ROLES.tsukebitoGrowth;
    fatigue += ROLES.tsukebitoFatigue;
  } else if (role === 'chankoban') {
    growth *= 1 - ROLES.chankoGrowthLoss * roles.chankoLoad;
    fatigue += ROLES.chankoFatigue * roles.chankoLoad;
  }
  return { growth, fatigue };
}
