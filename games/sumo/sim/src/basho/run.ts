/**
 * 本場所（15日）を進める
 *
 * - 関取は15番、幕下以下は7番
 * - 組み方: 序盤は番付の近い者どうし、終盤（関取は11日目から・幕下以下は2番目から）は同じ星どうし
 * - 同じ部屋どうしは当たらない。同じ相手とは1場所に1度だけ
 * - けがをしている力士は全休。場所中にけがをしたら、その日から休場
 * - 人数が奇数の段は、余った力士が下の段の上位と取る（下の段がその日に取らないときは、その日は取組なし）
 */
import { BOUTS, DIVISIONS } from '../balance/banzuke';
import { BOUT } from '../balance/bout';
import { GROWTH } from '../balance/growth';
import { KENSHO } from '../balance/money';
import { createPrng, deriveSeed, SEED } from '../core/prng';
import type { BoutResult, Division, Rank, Rikishi, Title } from '../model/types';
import { divisionCounts, ranksOf } from '../banzuke/rank';
import { eastWinProbability, kimariteFor } from './strength';

export interface Record3 {
  wins: number;
  losses: number;
  absences: number;
}

export interface BashoOutcome {
  ranks: Map<number, Rank>;
  records: Map<number, Record3>;
  bouts: BoutResult[];
  /** 段ごとの優勝者 */
  yusho: Map<Division, number>;
  /** 場所中にけがをした力士 */
  injured: number[];
  /** 金星（平幕が横綱に勝った数） */
  kinboshi: Map<number, number>;
  /** 懸賞の手取り（円） */
  kenshoYen: Map<number, number>;
  /** 優勝決定戦に出た力士（同点が2人以上いた段だけ。勝ち抜きの順） */
  playoff: Map<Division, number[]>;
}

/** 場所中のけがの確率（1番あたり） */
const BOUT_INJURY = 0.004;

export function runBasho(
  seed: number,
  bashoIndex: number,
  banzuke: readonly number[],
  titles: Record<number, Title>,
  byId: ReadonlyMap<number, Rikishi>,
): BashoOutcome {
  const rng = createPrng(deriveSeed(seed, SEED.bout, bashoIndex));
  const condRng = createPrng(deriveSeed(seed, SEED.condition, bashoIndex));
  const ranks = ranksOf(banzuke, titles);
  const order = new Map(banzuke.map((id, i) => [id, i]));
  const records = new Map<number, Record3>();
  const condition = new Map<number, number>();
  const active = new Set<number>();
  for (const id of banzuke) {
    records.set(id, { wins: 0, losses: 0, absences: 0 });
    const r = byId.get(id)!;
    // けがを押して出る力士は調子が大きく落ちる
    const hurt = r.injury > 0 && r.playHurt;
    condition.set(
      id,
      condRng.range(-BOUT.conditionRange, BOUT.conditionRange) -
        (hurt ? GROWTH.playHurt.conditionPenalty : 0),
    );
    if (r.injury === 0 || hurt) active.add(id);
  }
  const met = new Map<number, Set<number>>();
  const hasMet = (a: number, b: number) => met.get(a)?.has(b) ?? false;
  const meet = (a: number, b: number) => {
    if (!met.has(a)) met.set(a, new Set());
    if (!met.has(b)) met.set(b, new Set());
    met.get(a)!.add(b);
    met.get(b)!.add(a);
  };
  const bouts: BoutResult[] = [];
  const injured: number[] = [];
  const kinboshi = new Map<number, number>();
  const kenshoYen = new Map<number, number>();
  const boutsOf = (id: number) => {
    const d = ranks.get(id)!.division;
    return d === 'makuuchi' || d === 'juryo' ? BOUTS.sekitori : BOUTS.lower;
  };
  const played = (id: number) => {
    const r = records.get(id)!;
    return r.wins + r.losses;
  };

  const counts = divisionCounts(banzuke.length);
  const groups: number[][] = [];
  let start = 0;
  for (const d of DIVISIONS) {
    groups.push(banzuke.slice(start, start + counts[d]));
    start += counts[d];
  }

  const playBout = (a: number, b: number, day: number) => {
    meet(a, b);
    // 番付が上の方を東にする
    const [east, west] = order.get(a)! < order.get(b)! ? [a, b] : [b, a];
    const re = byId.get(east)!;
    const rw = byId.get(west)!;
    const p = eastWinProbability(re, rw, condition.get(east)!, condition.get(west)!);
    const winner = rng.chance(p) ? east : west;
    const loser = winner === east ? west : east;
    records.get(winner)!.wins++;
    records.get(loser)!.losses++;
    const rankE = ranks.get(east)!;
    const rankW = ranks.get(west)!;
    const kensho =
      rankE.division === 'makuuchi'
        ? Math.max(KENSHO.perBoutByTitle[rankE.title!], KENSHO.perBoutByTitle[rankW.title ?? 'M'])
        : 0;
    if (kensho) kenshoYen.set(winner, (kenshoYen.get(winner) ?? 0) + kensho * KENSHO.toRikishi);
    const rankWinner = winner === east ? rankE : rankW;
    const rankLoser = winner === east ? rankW : rankE;
    if (rankWinner.title === 'M' && rankLoser.title === 'Y')
      kinboshi.set(winner, (kinboshi.get(winner) ?? 0) + 1);
    bouts.push({
      day,
      eastId: east,
      westId: west,
      winnerId: winner,
      kimarite: kimariteFor(byId.get(winner)!, (items) => rng.pick(items)),
      kensho,
      fusen: false,
    });
    // 場所中のけが（負けた側が少しだけ多い）
    for (const id of [loser, winner]) {
      const r = byId.get(id)!;
      const chance =
        (BOUT_INJURY + r.fatigue * GROWTH.injuryPerFatigue * 0.1) *
        r.fragility *
        (id === loser ? 1.5 : 1) *
        (r.injury > 0 ? GROWTH.playHurt.boutInjuryMultiplier : 1);
      if (rng.chance(chance)) {
        active.delete(id);
        injured.push(id);
      }
    }
  };
  const canPlay = (id: number) => active.has(id) && played(id) < boutsOf(id);

  for (let day = 1; day <= BOUTS.sekitori; day++) {
    let carry: number | null = null;
    groups.forEach((group, gi) => {
      const sekitori = gi <= 1;
      // 幕下以下は 15日のうち 7日だけ取る（1,3,5,7,9,11,13 日目）
      if (!sekitori && (day % 2 === 0 || day > 13)) {
        // 十両で余った力士は、幕下の上位（まだ7番取っていない者）と取る
        if (carry !== null && gi === 2) {
          const c = carry;
          const opp = group.find(
            (id) =>
              canPlay(id) && byId.get(id)!.stableId !== byId.get(c)!.stableId && !hasMet(c, id),
          );
          if (opp !== undefined) playBout(c, opp, day);
        }
        carry = null;
        return;
      }
      const lowerRound = Math.floor(day / 2); // 0〜6
      const swiss = sekitori ? day >= 11 : lowerRound >= 1;
      let pool = group.filter(canPlay);
      if (carry !== null) pool = [carry, ...pool];
      carry = null;
      // 一番下の段で奇数なら、取った番数のいちばん多い者がその日は休み（番数が偏らないように）
      if (gi === groups.length - 1 && pool.length % 2 === 1) {
        const rest = [...pool].sort(
          (a, b) => played(b) - played(a) || order.get(b)! - order.get(a)!,
        )[0]!;
        pool = pool.filter((id) => id !== rest);
      }
      if (swiss) {
        pool.sort(
          (a, b) => records.get(b)!.wins - records.get(a)!.wins || order.get(a)! - order.get(b)!,
        );
      }
      const paired = new Set<number>();
      const pairs: [number, number][] = [];
      const leftover: number[] = [];
      for (let i = 0; i < pool.length; i++) {
        const a = pool[i]!;
        if (paired.has(a)) continue;
        const ra = byId.get(a)!;
        // 条件に合う相手を近い順に探す。いなければ（終盤の組み合わせの詰まり）同じ部屋以外なら再戦も許す
        const find = (allowRematch: boolean) => {
          for (let j = i + 1; j < pool.length; j++) {
            const b = pool[j]!;
            if (paired.has(b) || byId.get(b)!.stableId === ra.stableId) continue;
            if (!allowRematch && hasMet(a, b)) continue;
            return b;
          }
          return null;
        };
        const partner = find(false) ?? find(true);
        if (partner === null) {
          leftover.push(a);
          continue;
        }
        paired.add(a);
        paired.add(partner);
        pairs.push([a, partner]);
      }
      // 余った者どうしが同じ部屋なら、組んだ取組と入れ替える（例: 段の一番下に同じ部屋の新弟子が並んだとき）
      const ok = (x: number, y: number) =>
        byId.get(x)!.stableId !== byId.get(y)!.stableId && !hasMet(x, y);
      while (leftover.length >= 2) {
        const u = leftover.shift()!;
        const vi = leftover.findIndex((v) => ok(u, v));
        if (vi >= 0) {
          pairs.push([u, leftover.splice(vi, 1)[0]!]);
          continue;
        }
        const v = leftover[0]!;
        const k = pairs.findIndex(([x, y]) => (ok(u, x) && ok(v, y)) || (ok(u, y) && ok(v, x)));
        if (k < 0) continue; // 入れ替えられない（u はこの日は取組なし）
        const [x, y] = pairs[k]!;
        leftover.shift();
        if (ok(u, x) && ok(v, y)) pairs.splice(k, 1, [u, x], [v, y]);
        else pairs.splice(k, 1, [u, y], [v, x]);
      }
      if (leftover.length === 1 && gi < groups.length - 1) carry = leftover[0]!;
      for (const [x, y] of pairs) playBout(x, y, day);
    });
  }

  // けがで出なかった番は休場（全休・途中休場）。組む相手がいなかっただけの番は数えない
  for (const id of banzuke) {
    const r = records.get(id)!;
    r.absences = active.has(id) ? 0 : boutsOf(id) - r.wins - r.losses;
  }

  // 優勝（同点は決定戦。番付の上の者から順に勝ち抜き）
  const yusho = new Map<Division, number>();
  const playoff = new Map<Division, number[]>();
  DIVISIONS.forEach((d, gi) => {
    const group = groups[gi]!;
    if (group.length === 0) return;
    const best = Math.max(...group.map((id) => records.get(id)!.wins));
    const tied = group.filter((id) => records.get(id)!.wins === best);
    if (tied.length > 1) playoff.set(d, tied);
    let champ = tied[0]!;
    for (const challenger of tied.slice(1)) {
      const p = eastWinProbability(
        byId.get(champ)!,
        byId.get(challenger)!,
        condition.get(champ)!,
        condition.get(challenger)!,
      );
      if (!rng.chance(p)) champ = challenger;
    }
    yusho.set(d, champ);
  });

  return { ranks, records, bouts, yusho, injured, kinboshi, kenshoYen, playoff };
}
