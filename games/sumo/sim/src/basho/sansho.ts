/**
 * 三賞の選考（幕内の関脇以下で勝ち越した力士から）
 *
 * - 殊勲賞: 横綱・大関を倒した力士（倒した数 → 勝ち星の多い順）
 * - 敢闘賞: 勝ち星の多い力士（優勝した平幕・三役は必ず候補）
 * - 技能賞: 違う決まり手で多く勝った力士
 * それぞれ上限の人数まで。基準に届く力士がいなければ「該当者なし」
 */
import { KIMARITE_BY_ID } from '../balance/kimarite';
import { SANSHO } from '../balance/sansho';
import type { BoutResult, Rank } from '../model/types';
import type { Record3 } from './run';

export interface SanshoResult {
  shukun: number[];
  kanto: number[];
  gino: number[];
}

export function selectSansho(
  ranks: ReadonlyMap<number, Rank>,
  records: ReadonlyMap<number, Record3>,
  bouts: readonly BoutResult[],
  makuuchiYusho: number | undefined,
): SanshoResult {
  const eligible = [...records.keys()].filter((id) => {
    const rank = ranks.get(id)!;
    const r = records.get(id)!;
    return (
      rank.division === 'makuuchi' &&
      rank.title !== 'Y' &&
      rank.title !== 'O' &&
      r.wins > r.losses + r.absences
    );
  });
  const topWins = new Map<number, number>();
  const kimarite = new Map<number, Set<string>>();
  for (const b of bouts) {
    const loser = b.winnerId === b.eastId ? b.westId : b.eastId;
    const lt = ranks.get(loser)?.title;
    if (lt === 'Y' || lt === 'O') topWins.set(b.winnerId, (topWins.get(b.winnerId) ?? 0) + 1);
    // 非技（勇み足など）は相手の自滅なので、技の数に数えない
    if (KIMARITE_BY_ID.get(b.kimarite)?.group === 'hiwaza') continue;
    if (!kimarite.has(b.winnerId)) kimarite.set(b.winnerId, new Set());
    kimarite.get(b.winnerId)!.add(b.kimarite);
  }
  const wins = (id: number) => records.get(id)!.wins;
  const order = (a: number, b: number) => wins(b) - wins(a) || a - b;

  const shukun = eligible
    .filter(
      (id) => (topWins.get(id) ?? 0) >= SANSHO.shukunTopWins && wins(id) >= SANSHO.shukunMinWins,
    )
    .sort((a, b) => (topWins.get(b) ?? 0) - (topWins.get(a) ?? 0) || order(a, b))
    .slice(0, SANSHO.maxPerPrize);
  const kanto = eligible
    .filter((id) => wins(id) >= SANSHO.kantoMinWins || id === makuuchiYusho)
    .sort(order)
    .slice(0, SANSHO.maxPerPrize);
  const gino = eligible
    .filter(
      (id) =>
        wins(id) >= SANSHO.ginoMinWins && (kimarite.get(id)?.size ?? 0) >= SANSHO.ginoMinKimarite,
    )
    .sort((a, b) => (kimarite.get(b)?.size ?? 0) - (kimarite.get(a)?.size ?? 0) || order(a, b))
    .slice(0, SANSHO.maxPerPrize);
  return { shukun, kanto, gino };
}
