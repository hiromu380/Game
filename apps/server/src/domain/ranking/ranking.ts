/**
 * デイリーのランキング（上位・自分の前後・上位○%）
 *
 * 順位は「自分より上位の件数 + 1」を SQL で数えて求める（全件を読まない）。
 * 並び順の定義は packages/shared/src/ranking/rankKey.ts。
 */
import { topPercent, type RankingEntry, type RankingResponse } from '@chain-factory/shared';
import { SERVER_LIMITS } from '../../config/server';
import type { PlayerRecord, RankedRow } from '../../repositories/types';
import { DomainError, type DomainContext } from '../context';
import { isDailyId } from '../daily/calendar';

const toEntry = (row: RankedRow, rank: number, me: PlayerRecord | null): RankingEntry => ({
  rank,
  displayName: row.displayName,
  shiftsCleared: row.shiftsCleared,
  score: row.score.text,
  maxChain: row.maxChain,
  isMe: row.playerId === me?.id,
});

export async function getRanking(
  ctx: DomainContext,
  dailyId: string,
  me: PlayerRecord | null,
): Promise<RankingResponse> {
  if (!isDailyId(dailyId)) throw new DomainError('badRequest');
  const { results } = ctx.repos;
  const total = await results.count(dailyId);
  const top = (await results.list(dailyId, 0, SERVER_LIMITS.rankingTop)).map((row, i) =>
    toEntry(row, i + 1, me),
  );

  const mine = me && !me.hidden ? await results.find(dailyId, me.id) : null;
  if (!mine) return { dailyId, total, top, around: [], me: null };

  const rank = (await results.countAbove(dailyId, mine)) + 1;
  const from = Math.max(0, rank - 1 - SERVER_LIMITS.rankingAround);
  const around = (await results.list(dailyId, from, SERVER_LIMITS.rankingAround * 2 + 1)).map(
    (row, i) => toEntry(row, from + i + 1, me),
  );
  return { dailyId, total, top, around, me: { rank, topPercent: topPercent(rank, total) } };
}
