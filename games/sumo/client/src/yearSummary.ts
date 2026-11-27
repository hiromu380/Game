/**
 * 1年のふりかえり（九州場所の後の見せ場）: その年の6場所の部屋の歩みをまとめる純粋関数
 * 弟子の成績は今の弟子と元弟子の場所ごとの記録（track）から、お金と順位は経営の記録（moneyLog）から、
 * 昇進・優勝・入門は日誌から数える。セーブに持たない
 */
import type { GameState, TrackEntry } from '@ichimon/sim';

export interface YearSummary {
  /** 何年目か（1から） */
  year: number;
  wins: number;
  losses: number;
  /** 勝ち越した場所の延べ数 / 出た場所の延べ数 */
  kachikoshi: number;
  appearances: number;
  promotions: number;
  yusho: number;
  joined: number;
  /** 部屋の収支の合計（記録のある場所だけ） */
  net: number;
  /** 名声の動き（年の初めの記録から、年の終わりまで。記録が足りなければ null） */
  prestige: number | null;
  /** 部屋の力の順位（年の最初の場所の後 → 年の終わり） */
  place: { from: number; to: number } | null;
  /** 部屋の年間最多勝: その年いちばん白星の多い弟子（同じなら黒星の少ない方、さらに同じなら ID の小さい方）。いなければ null */
  mvp: { name: string; wins: number; losses: number } | null;
}

/** lastIndex: 年の最後の場所の番号（九州場所） */
export function yearSummary(game: GameState, lastIndex: number): YearSummary {
  const first = lastIndex - (lastIndex % 6);
  const inYear = (i: number) => i >= first && i <= lastIndex;
  const people = [
    ...game.rikishi
      .filter((r) => r.stableId === game.player.stableId)
      .map((r) => ({ id: r.id, name: r.name, track: r.track })),
    ...game.player.alumni.map((a) => ({ id: a.id, name: a.name, track: a.track ?? [] })),
  ];
  const mvp =
    people
      .map((p) => {
        const es = p.track.filter((e) => inYear(e.bashoIndex));
        return {
          id: p.id,
          name: p.name,
          wins: es.reduce((s, e) => s + e.wins, 0),
          losses: es.reduce((s, e) => s + e.losses, 0),
        };
      })
      .filter((p) => p.wins > 0)
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.id - b.id)[0] ?? null;
  const tracks: TrackEntry[] = [
    ...game.rikishi.filter((r) => r.stableId === game.player.stableId).flatMap((r) => r.track),
    ...game.player.alumni.flatMap((a) => a.track ?? []),
  ].filter((e) => inYear(e.bashoIndex));
  const played = tracks.filter((e) => e.wins + e.losses > 0);
  const log = game.moneyLog.filter((e) => inYear(e.bashoIndex));
  const before = game.moneyLog.filter((e) => e.bashoIndex < first).at(-1);
  const firstLog = log[0];
  const lastLog = log.at(-1);
  const journal = game.journal.filter((e) => inYear(e.bashoIndex));
  return {
    year: Math.floor(lastIndex / 6) + 1,
    wins: played.reduce((s, e) => s + e.wins, 0),
    losses: played.reduce((s, e) => s + e.losses, 0),
    kachikoshi: played.filter((e) => e.wins * 2 > e.wins + e.losses + e.absences).length,
    appearances: played.length,
    promotions: journal.filter((e) => e.kind === 'promote').length,
    yusho: journal.filter((e) => e.kind === 'yusho').length,
    joined: journal.filter((e) => e.kind === 'join').length,
    net: log.reduce((s, e) => s + e.income - e.expenses, 0),
    prestige:
      lastLog && (before ?? firstLog) ? lastLog.prestige - (before ?? firstLog)!.prestige : null,
    place:
      firstLog?.place !== undefined && lastLog?.place !== undefined
        ? { from: (before?.place ?? firstLog.place)!, to: lastLog.place }
        : null,
    mvp: mvp && { name: mvp.name, wins: mvp.wins, losses: mvp.losses },
  };
}
