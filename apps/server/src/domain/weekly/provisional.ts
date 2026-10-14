/**
 * 当週の暫定ランキング（自分の暫定順位・上位○%・参加人数・暫定トップ）
 *
 * - 返すのは順位・表示名・出荷量・クリアしたシフト数だけ。他人の配置・操作ログ・盤面は返さない
 *   （当週分の他人の提出データを取れる API は作らない: CLAUDE.md「ランキング」）
 * - 並びは cacheSeconds ごとにまとめて読み直してキャッシュする（1回の表示で全件を読まない）。
 *   自分の順位は、自分の最新のベストを DB から読み、キャッシュの並びに二分探索で当てはめて求める
 * - 非表示のプレイヤー（不適切な名前など）は並びに入れない
 */
import {
  compareRankKey,
  topPercent,
  type ProvisionalRankingResponse,
  type RankingEntry,
  type RankKey,
} from '@chain-factory/shared';
import { WEEKLY_CONFIG } from '../../config/weekly';
import type { BestRecord, PlayerRecord } from '../../repositories/types';
import { DomainError, type DomainContext } from '../context';
import { isDateId } from './calendar';
import { currentWeekId } from './weeks';

/** キャッシュに置く並び（キーを短くして容量を抑える） */
interface Snapshot {
  updatedAt: number;
  /** 並び順: [playerId, 表示名, クリアしたシフト数, 桁数, 先頭15桁, 全桁, 提出時刻] */
  rows: [string, string, number, number, number, string, number][];
}

type Row = Snapshot['rows'][number];
const keyOf = (r: Row): RankKey => ({
  shiftsCleared: r[2],
  score: { digits: r[3], head: r[4], text: r[5] },
  submittedAt: r[6],
});

async function loadSnapshot(ctx: DomainContext, weekId: string): Promise<Snapshot> {
  const cacheKey = `provisional:${weekId}`;
  const cached = await ctx.cache.get(cacheKey);
  if (cached) return JSON.parse(cached) as Snapshot;
  const ranked = await ctx.repos.bests.listRanked(weekId);
  const snapshot: Snapshot = {
    updatedAt: ctx.now(),
    rows: ranked.map((b) => [
      b.playerId,
      b.displayName,
      b.shiftsCleared,
      b.score.digits,
      b.score.head,
      b.score.text,
      b.submittedAt,
    ]),
  };
  await ctx.cache.put(cacheKey, JSON.stringify(snapshot), WEEKLY_CONFIG.provisional.cacheSeconds);
  return snapshot;
}

/** 出荷量を上 3 桁に丸める（暫定トップの丸め表示） */
export function roundScore(text: string): string {
  if (text.length <= 3) return text;
  return text.slice(0, 3) + '0'.repeat(text.length - 3);
}

/** key より上位の行の数（並びは昇順に整列済み。自分の古い行は除いて数える） */
function countAbove(rows: Row[], key: RankKey, myId: string): number {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (compareRankKey(keyOf(rows[mid]!), key) < 0) lo = mid + 1;
    else hi = mid;
  }
  // 二分探索の結果から、自分の古い行（上位にあれば）を除く
  const mineAbove = rows.slice(0, lo).some((r) => r[0] === myId) ? 1 : 0;
  return lo - mineAbove;
}

export async function getProvisional(
  ctx: DomainContext,
  weekId: string,
  me: PlayerRecord | null,
): Promise<ProvisionalRankingResponse> {
  if (!isDateId(weekId)) throw new DomainError('badRequest');
  // 暫定ランキングは当週だけ（過去週は確定した結果発表、未来週はまだない）
  if (weekId !== currentWeekId(ctx)) throw new DomainError('notPublished');
  const { top: topCount, topMode, around: aroundCount } = WEEKLY_CONFIG.provisional;
  const snapshot = await loadSnapshot(ctx, weekId);
  const myBest: BestRecord | null =
    me && !me.hidden ? await ctx.repos.bests.find(weekId, me.id) : null;

  // 自分の最新のベストを並びに当てはめる（キャッシュより新しい成績でも順位がわかるように）
  let rows = snapshot.rows;
  if (myBest) {
    const mine: Row = [
      myBest.playerId,
      me!.displayName,
      myBest.shiftsCleared,
      myBest.score.digits,
      myBest.score.head,
      myBest.score.text,
      myBest.submittedAt,
    ];
    const without = rows.filter((r) => r[0] !== myBest.playerId);
    const at = countAbove(without, myBest, myBest.playerId);
    rows = [...without.slice(0, at), mine, ...without.slice(at)];
  }
  const total = rows.length;

  const toEntry = (r: Row, i: number): RankingEntry => ({
    rank: i + 1,
    displayName: r[1],
    shiftsCleared: r[2],
    // 丸め表示でも自分の出荷量は実数で出す
    score: topMode === 'rounded' && r[0] !== me?.id ? roundScore(r[5]) : r[5],
    daysPlayed: 0,
    isMe: r[0] === me?.id,
  });
  const myIndex = myBest ? rows.findIndex((r) => r[0] === myBest.playerId) : -1;
  const from = Math.max(0, myIndex - aroundCount);
  return {
    weekId,
    provisional: true,
    total,
    topMode,
    top: topMode === 'hidden' ? [] : rows.slice(0, topCount).map(toEntry),
    around:
      topMode === 'hidden' || myIndex < 0
        ? []
        : rows.slice(from, myIndex + aroundCount + 1).map((r, i) => toEntry(r, from + i)),
    me: myIndex < 0 ? null : { rank: myIndex + 1, topPercent: topPercent(myIndex + 1, total) },
    updatedAt: snapshot.updatedAt,
  };
}
