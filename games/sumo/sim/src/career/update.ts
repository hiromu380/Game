/**
 * 場所の後の記録の更新と、力士本人の収入（演出用。部屋の会計とは別）
 */
import { LOWER_PAY, MOCHIKYUKIN, SEKITORI_MONTHLY, YUSHO_PRIZE } from '../balance/money';
import { isSanyaku, isSekitori } from '../banzuke/rank';
import type { BashoRecord, Rank, Rikishi } from '../model/types';

const RECENT_KEEP = 6;

export interface CareerUpdate {
  record: BashoRecord;
  kinboshi: number;
  kenshoYen: number;
  /** 全勝か */
  zensho: boolean;
}

/** 場所の成績を記録に足す（地位はその場所の地位） */
export function applyBasho(r: Rikishi, u: CareerUpdate): void {
  const c = r.career;
  const { record } = u;
  const rank = record.rank;
  c.basho++;
  if (rank.division === 'makuuchi') c.makuuchiBasho++;
  if (isSekitori(rank)) c.sekitoriBasho++;
  if (isSanyaku(rank)) c.sanyakuBasho++;
  c.wins += record.wins;
  c.losses += record.losses;
  c.absences += record.absences;
  c.kinboshi += u.kinboshi;
  if (record.yusho) {
    if (rank.division === 'makuuchi') c.makuuchiYusho++;
    else c.otherYusho++;
  }
  // 持ち給金: 勝ち越し1つ 0.5円・金星 10円・幕内優勝 30円（全勝 50円）
  const netWins = record.wins - record.losses - record.absences;
  if (netWins > 0) c.mochikyukinHalf += netWins * MOCHIKYUKIN.perKachikoshiWinHalf;
  c.mochikyukinHalf += u.kinboshi * MOCHIKYUKIN.kinboshiHalf;
  if (record.yusho && rank.division === 'makuuchi') {
    c.mochikyukinHalf += u.zensho ? MOCHIKYUKIN.zenshoHalf : MOCHIKYUKIN.yushoHalf;
  }
  c.earnings += payFor(rank, record, c.mochikyukinHalf) + u.kenshoYen;
  r.recent = [record, ...r.recent].slice(0, RECENT_KEEP);
}

/** その場所に本人が受け取るお金（月給2か月分・褒賞金・懸賞・優勝賞金 / 場所手当・勝星金） */
export function payFor(rank: Rank, record: BashoRecord, mochikyukinHalf: number): number {
  if (isSekitori(rank)) {
    const key =
      rank.title === 'Y'
        ? 'Y'
        : rank.title === 'O'
          ? 'O'
          : rank.title === 'S' || rank.title === 'K'
            ? 'sanyaku'
            : rank.title === 'M'
              ? 'M'
              : 'juryo';
    const monthly = SEKITORI_MONTHLY[key] * 2;
    const hoshokin = (mochikyukinHalf / 2) * MOCHIKYUKIN.yenPerUnit;
    const prize = record.yusho
      ? YUSHO_PRIZE[rank.division === 'makuuchi' ? 'makuuchi' : 'juryo']
      : 0;
    return monthly + hoshokin + prize;
  }
  const pay = LOWER_PAY[rank.division as keyof typeof LOWER_PAY];
  return (
    pay.allowance +
    pay.perWin * record.wins +
    (record.wins * 2 > record.wins + record.losses + record.absences ? pay.kachikoshi : 0) +
    (record.yusho ? pay.yusho : 0)
  );
}

/** 新しい地位の持ち給金の最低額 */
export function applyMochikyukinMinimum(r: Rikishi, rank: Rank): void {
  const m = MOCHIKYUKIN.minimumHalf;
  const min =
    rank.title === 'Y'
      ? m.Y
      : rank.title === 'O'
        ? m.O
        : rank.division === 'makuuchi'
          ? m.M
          : rank.division === 'juryo'
            ? m.juryo
            : 0;
  r.career.mochikyukinHalf = Math.max(r.career.mochikyukinHalf, min);
}

/** 最高位の更新（order は新しい番付の上からの順位） */
export function applyHighest(r: Rikishi, rank: Rank, order: number): void {
  if (order < r.career.highestOrder) {
    r.career.highestOrder = order;
    r.career.highestRank = rank;
  }
}
