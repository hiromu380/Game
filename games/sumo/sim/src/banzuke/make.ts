/**
 * 番付編成（場所の成績から次の番付を作る）
 *
 * 実際の編成会議を簡略にした規則（docs/realism.md「ゲームで省いた・まとめたこと」）:
 * - 横綱は落ちない。大関で2場所の好成績（優勝を含み合計の勝ち星が基準以上）なら横綱へ
 * - 大関は2場所続けて負け越すと関脇へ。落ちた翌場所に10勝すれば大関へ戻る
 * - 関脇で、三役の直近3場所の勝ち星の合計が基準以上（最後の場所も基準以上）なら大関へ
 * - 関脇・小結は勝ち越せば残る。足りない分は成績のよい者から埋める（それぞれ最低2人）
 * - それ以外は「前の位置 − 勝ち越しの数 × 段ごとの枚数」で並べ直す。勝ち越して下がる・負け越して上がることはない
 * - 幕下から十両へは、幕下15枚目以内の全勝（必ず）と、幕下5枚目以内の勝ち越し（空いた枠まで）だけ。候補が足りなければ十両が残る
 */
import { BOUTS, DIVISION_SIZE, MIN_SANYAKU, MOVE_PER_NET, PROMOTION } from '../balance/banzuke';
import type { BashoRecord, Rank, Title } from '../model/types';
import type { Record3 } from '../basho/run';

export interface BanzukeInput {
  /** 前の番付（上から順） */
  banzuke: readonly number[];
  ranks: ReadonlyMap<number, Rank>;
  records: ReadonlyMap<number, Record3>;
  /** その場所の優勝者（幕内） */
  makuuchiYusho: number | undefined;
  /** 力士ごとの直近の成績（新しい順。今の場所を含む） */
  recentOf: (id: number) => readonly BashoRecord[];
  exOzeki: (id: number) => boolean;
  /** 引退した力士（番付から外す） */
  retired: ReadonlySet<number>;
  /** 新しく番付に載る力士（下に足す。入門順） */
  newcomers: readonly number[];
}

export interface BanzukeOutput {
  banzuke: number[];
  titles: Record<number, Title>;
  /** 新しく横綱・大関になった力士 */
  newYokozuna: number[];
  newOzeki: number[];
  /** 大関から落ちた力士 */
  demotedOzeki: number[];
}

const net = (r: Record3) => r.wins - r.losses - r.absences;
const kachikoshi = (r: Record3) => net(r) > 0;

function isYusho(rec: BashoRecord) {
  return rec.yusho;
}

export function makeBanzuke(input: BanzukeInput): BanzukeOutput {
  const { banzuke, ranks, records, retired } = input;
  const order = new Map(banzuke.map((id, i) => [id, i]));
  const live = banzuke.filter((id) => !retired.has(id));
  const titleOf = (id: number) => ranks.get(id)!.title;
  const rec = (id: number) => records.get(id)!;

  const yokozuna: number[] = [];
  const ozeki: number[] = [];
  const newYokozuna: number[] = [];
  const newOzeki: number[] = [];
  const demotedOzeki: number[] = [];

  // 横綱は残る
  for (const id of live) if (titleOf(id) === 'Y') yokozuna.push(id);

  // 大関: 横綱への昇進・陥落
  for (const id of live) {
    if (titleOf(id) !== 'O') continue;
    const recent = input.recentOf(id);
    const [now, prev] = recent;
    if (
      now &&
      prev &&
      now.rank.title === 'O' &&
      prev.rank.title === 'O' &&
      (isYusho(now) || isYusho(prev)) &&
      now.wins + prev.wins >= PROMOTION.yokozunaWins2 &&
      (isYusho(now) && isYusho(prev)
        ? true
        : Math.min(now.wins, prev.wins) >= PROMOTION.yokozunaOtherMin)
    ) {
      yokozuna.push(id);
      newYokozuna.push(id);
      continue;
    }
    const makekoshiNow = !kachikoshi(rec(id));
    const makekoshiPrev = prev?.rank.title === 'O' && prev.wins * 2 < BOUTS.sekitori;
    if (makekoshiNow && makekoshiPrev) {
      demotedOzeki.push(id);
      continue;
    }
    ozeki.push(id);
  }

  // 関脇から大関へ（三役で3場所の合計）・大関から落ちた翌場所に10勝で戻る
  for (const id of live) {
    if (titleOf(id) !== 'S') continue;
    const r = rec(id);
    if (input.exOzeki(id) && r.wins >= PROMOTION.ozekiReturnWins) {
      ozeki.push(id);
      newOzeki.push(id);
      continue;
    }
    const last3 = input.recentOf(id).slice(0, 3);
    if (
      last3.length === 3 &&
      last3.every((b) => b.rank.title === 'S' || b.rank.title === 'K') &&
      last3.reduce((n, b) => n + b.wins, 0) >= PROMOTION.ozekiWins3 &&
      r.wins >= PROMOTION.ozekiLastMin
    ) {
      ozeki.push(id);
      newOzeki.push(id);
    }
  }
  const placed = new Set([...yokozuna, ...ozeki]);

  // 関脇・小結以外の並べ直し（前の位置 − 勝ち越しの数 × 枚数）
  const scoreOf = (id: number) => {
    const old = order.get(id) ?? live.length;
    const r = rec(id);
    const move = MOVE_PER_NET[ranks.get(id)!.division] * 2 * net(r);
    const score = old - move;
    // 勝ち越して下がらない・負け越して上がらない
    if (net(r) > 0) return Math.min(score, old - 0.5);
    if (net(r) < 0) return Math.max(score, old + 0.5);
    return old;
  };
  const byScore = (a: number, b: number) =>
    scoreOf(a) - scoreOf(b) || rec(b).wins - rec(a).wins || order.get(a)! - order.get(b)!;

  // 関脇: 勝ち越した関脇と落ちた大関。小結で11勝以上も関脇へ
  const sekiwake: number[] = [];
  const komusubi: number[] = [];
  for (const id of live) {
    if (placed.has(id)) continue;
    const t = titleOf(id);
    const r = rec(id);
    if (t === 'S' && kachikoshi(r)) sekiwake.push(id);
    else if (t === 'K' && r.wins >= 11) sekiwake.push(id);
  }
  sekiwake.push(...demotedOzeki);
  // 小結: 勝ち越した小結・7勝8敗くらいの関脇
  for (const id of live) {
    if (placed.has(id) || sekiwake.includes(id)) continue;
    const t = titleOf(id);
    const r = rec(id);
    if (t === 'K' && kachikoshi(r)) komusubi.push(id);
    else if (t === 'S' && r.wins >= 6) komusubi.push(id);
  }
  // 最低人数に満たなければ、成績のよい者（小結で勝ち越し → 前頭の上位から）で埋める
  const rest = () =>
    live
      .filter((id) => !placed.has(id) && !sekiwake.includes(id) && !komusubi.includes(id))
      .filter((id) => ranks.get(id)!.division === 'makuuchi' && kachikoshi(rec(id)))
      .sort(byScore);
  while (sekiwake.length < MIN_SANYAKU.S) {
    const fromK = komusubi.sort(byScore).shift();
    const next =
      fromK ??
      rest()[0] ??
      live.filter((id) => !placed.has(id) && !sekiwake.includes(id)).sort(byScore)[0];
    if (next === undefined) break;
    sekiwake.push(next);
  }
  while (komusubi.length < MIN_SANYAKU.K) {
    const next =
      rest()[0] ??
      live
        .filter((id) => !placed.has(id) && !sekiwake.includes(id) && !komusubi.includes(id))
        .sort(byScore)[0];
    if (next === undefined) break;
    komusubi.push(next);
  }

  sekiwake.sort(byScore);
  komusubi.sort(byScore);
  const topSet = new Set([...yokozuna, ...ozeki, ...sekiwake, ...komusubi]);
  const sorted = live.filter((id) => !topSet.has(id)).sort(byScore);
  const others = juryoLine(sorted, DIVISION_SIZE.makuuchi + DIVISION_SIZE.juryo - topSet.size, {
    ranks,
    records,
    byScore,
  });
  const next = [
    ...sortTitled(yokozuna, order),
    ...sortTitled(ozeki, order),
    ...sekiwake,
    ...komusubi,
    ...others,
    ...input.newcomers,
  ];

  const titles: Record<number, Title> = {};
  for (const id of yokozuna) titles[id] = 'Y';
  for (const id of ozeki) titles[id] = 'O';
  for (const id of sekiwake) titles[id] = 'S';
  for (const id of komusubi) titles[id] = 'K';
  return { banzuke: next, titles, newYokozuna, newOzeki, demotedOzeki };
}

/** 横綱・大関の中の並び: 前の番付の順（新しく上がった者は後ろ） */
function sortTitled(ids: number[], order: ReadonlyMap<number, number>): number[] {
  return [...ids].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
}

/**
 * 十両と幕下の境目を、十両昇進の目安に合わせて直す。sorted は三役より下を成績で並べたもの、seats はその中の関取（前頭と十両）の数。
 * - 幕下から関取の側へ入れるのは、幕下15枚目以内の全勝（必ず）と、幕下5枚目以内の勝ち越し
 * - 入れない幕下は幕下の側へ戻し、空いた枠は、成績のよい候補 → 落ちるはずだった関取 の順で埋める
 * - 上がった幕下は十両の下に置く（全勝が先）
 */
export function juryoLine(
  sorted: readonly number[],
  seats: number,
  ctx: {
    ranks: ReadonlyMap<number, Rank>;
    records: ReadonlyMap<number, Record3>;
    byScore: (a: number, b: number) => number;
  },
): number[] {
  const { ranks, records, byScore } = ctx;
  const fromMakushita = (id: number) => ranks.get(id)!.division === 'makushita';
  const sekitori = (id: number) => {
    const d = ranks.get(id)!.division;
    return d === 'makuuchi' || d === 'juryo';
  };
  const wins = (id: number) => records.get(id)!.wins;
  const n = (id: number) => ranks.get(id)!.number;
  const must = (id: number) =>
    fromMakushita(id) && n(id) <= PROMOTION.juryoZenshoWithin && wins(id) >= BOUTS.lower;
  const eligible = (id: number) =>
    must(id) ||
    (fromMakushita(id) && n(id) <= PROMOTION.juryoKachikoshiWithin && kachikoshi(records.get(id)!));
  if (seats <= 0) return [...sorted];
  const up = new Set(sorted.slice(0, seats).filter((id) => !fromMakushita(id) || eligible(id)));
  for (const id of sorted) if (must(id)) up.add(id);
  // 足りなければ: 候補（幕下5枚目以内の勝ち越し）→ 関取だった者（成績のよい順）
  const fill = (pick: (id: number) => boolean) => {
    for (const id of sorted) {
      if (up.size >= seats) return;
      if (!up.has(id) && pick(id)) up.add(id);
    }
  };
  fill(eligible);
  fill(sekitori);
  fill(() => true);
  // 多ければ: 必ず上がる者以外の、成績の悪い者から外す
  const inUp = [...up].sort(byScore);
  while (inUp.length > seats) {
    const i = inUp.map((id) => !must(id)).lastIndexOf(true);
    if (i < 0) break;
    up.delete(inUp[i]!);
    inUp.splice(i, 1);
  }
  // 幕下から上がった者は十両の下に（幕下の枚数で並べると、幕内まで飛んでしまう）。全勝が先、あとは成績の順
  const promoted = inUp
    .filter(fromMakushita)
    .sort((a, b) => Number(must(b)) - Number(must(a)) || byScore(a, b));
  return [
    ...inUp.filter((id) => !fromMakushita(id)),
    ...promoted,
    ...sorted.filter((id) => !up.has(id)),
  ];
}
