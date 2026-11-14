/**
 * 後援会とタニマチ（場所ごとの会費・ご祝儀・パーティー、タニマチの出入り）
 */
import { KOENKAI } from '../balance/koenkai';
import { isSanyaku, isSekitori } from '../banzuke/rank';
import { createPrng, deriveSeed, SEED, type Prng } from '../core/prng';
import { note } from '../game/journal';
import type { GameState, Koenkai, Patron, Rank } from '../model/types';
import { hasTrait } from '../career/traits';

export interface KoenkaiMoney {
  /** 会費（個人と法人） */
  dues: number;
  /** タニマチのご祝儀 */
  patrons: number;
  /** 千秋楽パーティーの費用 */
  party: number;
}

function counts(state: GameState, ranks: ReadonlyMap<number, Rank>) {
  let sekitori = 0;
  let sanyaku = 0;
  for (const r of state.rikishi) {
    if (r.stableId !== state.player.stableId) continue;
    const rank = ranks.get(r.id);
    if (rank && isSekitori(rank)) sekitori++;
    if (rank && isSanyaku(rank)) sanyaku++;
  }
  return { sekitori, sanyaku };
}

function targets(state: GameState, ranks: ReadonlyMap<number, Rank>) {
  const { sekitori, sanyaku } = counts(state, ranks);
  const p = state.player.prestige;
  return {
    members:
      KOENKAI.memberBase +
      p * KOENKAI.memberPerPrestige +
      sekitori * KOENKAI.memberPerSekitori +
      sanyaku * KOENKAI.memberPerSanyaku,
    corporate: sekitori * KOENKAI.corporatePerSekitori + p * KOENKAI.corporatePerPrestige,
    sekitori,
  };
}

/** ひいきの力士を選ぶ（関取 → 人気者 → 番付の上の順） */
function chooseFavorite(
  state: GameState,
  rng: Prng,
  ranks: ReadonlyMap<number, Rank>,
): number | null {
  const mine = state.rikishi.filter((r) => r.stableId === state.player.stableId);
  if (mine.length === 0) return null;
  const sekitori = mine.filter((r) => ranks.has(r.id) && isSekitori(ranks.get(r.id)!));
  const popular = mine.filter((r) => hasTrait(r, 'popular'));
  return rng.pick(sekitori.length ? sekitori : popular.length ? popular : mine).id;
}

function newPatron(
  state: GameState,
  rng: Prng,
  id: number,
  ranks: ReadonlyMap<number, Rank>,
): Patron {
  return {
    id,
    surname: rng.pick(KOENKAI.surnames),
    kind: rng.pick(KOENKAI.kinds),
    favor: KOENKAI.favorStart,
    favoriteId: chooseFavorite(state, rng, ranks),
    since: state.bashoIndex,
    visitedAt: null,
    lastGift: 0,
  };
}

/** 後援会を始める（開始時・セーブの変換）。地元の後援者が1人いる */
export function initKoenkai(state: GameState, ranks: ReadonlyMap<number, Rank>): Koenkai {
  const rng = createPrng(deriveSeed(state.seed, SEED.koenkai, state.bashoIndex, 0));
  const t = targets(state, ranks);
  const first = newPatron(state, rng, 1, ranks);
  first.kind = 'hometown';
  return {
    members: Math.round(t.members),
    corporate: Math.round(t.corporate),
    party: 'small',
    patrons: [first],
  };
}

/** タニマチへのご祝儀の額（人ごとの懐具合 × 関係） */
export function giftOf(p: Patron): number {
  const [lo, hi] = KOENKAI.patronGift;
  // 人ごとに額が違う（id から決まる）
  const base = lo + (((p.id * 7919) % 1000) / 1000) * (hi - lo);
  return Math.round((base * (0.5 + p.favor / 100)) / 10_000) * 10_000;
}

/**
 * 場所の後の後援会: 会員の増減・タニマチの関係とご祝儀・出入り。部屋に入るお金を返す
 * mine: この場所の自分の弟子の成績（勝ち越し・昇進でひいきのタニマチが喜ぶ）
 */
export function settleKoenkai(
  state: GameState,
  ranks: ReadonlyMap<number, Rank>,
  results: { id: number; kachikoshi: boolean }[],
  promoted: ReadonlySet<number>,
): KoenkaiMoney {
  const k = state.player.koenkai;
  const party = KOENKAI.party[k.party];
  const rng = createPrng(deriveSeed(state.seed, SEED.koenkai, state.bashoIndex, 1));
  const t = targets(state, ranks);
  k.members = Math.round(k.members + (t.members * party.members - k.members) * KOENKAI.memberMove);
  k.corporate = Math.round(k.corporate + (t.corporate - k.corporate) * KOENKAI.memberMove);
  const dues = Math.round(
    (k.members * KOENKAI.memberDuesPerYear + k.corporate * KOENKAI.corporateDuesPerYear) / 6,
  );
  const result = new Map(results.map((r) => [r.id, r.kachikoshi]));
  const alive = new Set(
    state.rikishi.filter((r) => r.stableId === state.player.stableId).map((r) => r.id),
  );
  let gifts = 0;
  for (const p of k.patrons) {
    // ひいきの力士が辞めた・移ったら、別の力士をひいきにする（少し寂しがる）
    if (p.favoriteId === null || !alive.has(p.favoriteId)) {
      p.favoriteId = chooseFavorite(state, rng, ranks);
      p.favor -= 5;
    }
    let d = -KOENKAI.favorDecay + party.favor;
    const fav = p.favoriteId;
    if (fav !== null && result.has(fav))
      d += result.get(fav) ? KOENKAI.favorKachikoshi : KOENKAI.favorMakekoshi;
    if (fav !== null && promoted.has(fav)) d += KOENKAI.favorPromotion;
    p.favor = Math.max(0, Math.min(100, p.favor + d));
    p.lastGift = giftOf(p);
    gifts += p.lastGift;
  }
  // 関係の薄れたタニマチは離れる
  for (const p of k.patrons.filter((x) => x.favor < KOENKAI.favorLeave)) {
    note(state, { kind: 'patron', event: 'leave', surname: p.surname, patronKind: p.kind });
  }
  k.patrons = k.patrons.filter((x) => x.favor >= KOENKAI.favorLeave);
  // 新しいタニマチ（関取と名声で来やすい）
  const chance =
    KOENKAI.patronBaseChance +
    t.sekitori * KOENKAI.patronChancePerSekitori +
    state.player.prestige * KOENKAI.patronChancePerPrestige;
  if (k.patrons.length < KOENKAI.patronMax && rng.chance(Math.min(0.6, chance))) {
    const id = Math.max(0, ...k.patrons.map((p) => p.id)) + 1 + state.bashoIndex * 10;
    const p = newPatron(state, rng, id, ranks);
    k.patrons.push(p);
    note(state, { kind: 'patron', event: 'join', surname: p.surname, patronKind: p.kind });
  }
  state.player.prestige += party.prestige;
  return { dues, patrons: gifts, party: party.cost };
}

/** タニマチに挨拶に行けるか（場所ごとに1回） */
export const canVisit = (p: Patron, bashoIndex: number) => p.visitedAt !== bashoIndex;
