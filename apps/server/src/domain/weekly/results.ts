/**
 * 結果発表（前週以前の確定ランキング）
 *
 * - 確定（finalizeWeek）: 週の締め切り＋猶予＋余裕のあと、その週のベストを並べて順位・上位○%を保存する。
 *   参加者が多くても1回の処理量を抑え（batch 件ずつ）、続きから再開できる。何度実行しても同じ結果になる
 * - 確定ランキング・リプレイ・秘密値は、締め切り後の週だけ返す（当週・未来週は notPublished、集計中は tallying）
 * - 表示名の非表示フラグは確定結果に焼き込まず、表示のときに反映する（確定後に非表示にしても外れる）
 */
import {
  topPercent,
  type RankingEntry,
  type ReplayResponse,
  type WeeklyLatestResponse,
  type WeeklyResultsResponse,
} from '@chain-factory/shared';
import { WEEKLY_CONFIG } from '../../config/weekly';
import type { PlayerRecord, StandingRecord, StandingRow } from '../../repositories/types';
import { DomainError, type DomainContext } from '../context';
import { addWeeks, isDateId } from './calendar';
import { commitSeedsFor, deriveWeekSecret } from './secret';
import { currentWeekId } from './weeks';

/** 結果を確定してよい時刻（締め切り＋猶予＋余裕） */
function finalizableAt(closesAt: number): number {
  return closesAt + WEEKLY_CONFIG.graceMs + WEEKLY_CONFIG.finalizeDelayMs;
}

/**
 * 週の結果を確定する（batch 件ずつ。終わっていれば何もしない）。
 * 戻り値は確定が終わったか
 */
export async function finalizeWeek(ctx: DomainContext, weekId: string): Promise<boolean> {
  const week = await ctx.repos.weeks.find(weekId);
  if (!week || ctx.now() < finalizableAt(week.closesAt)) return false;
  const all = await ctx.repos.bests.listAll(weekId);
  const progress = (await ctx.repos.finalizations.find(weekId)) ?? {
    weekId,
    total: all.length,
    processed: 0,
    finishedAt: null,
  };
  if (progress.finishedAt !== null) return true;

  // 締め切り後はベストが変わらないので、並びは毎回同じ（同順は playerId の順）
  const total = all.length;
  const slice = all.slice(progress.processed, progress.processed + WEEKLY_CONFIG.results.batch);
  const rows: StandingRecord[] = slice.map((b, i) => {
    const rank = progress.processed + i + 1;
    return { ...b, rank, topPercentMilli: topPercent(rank, total) * 1000 };
  });
  if (rows.length > 0) await ctx.repos.standings.putMany(rows);
  const processed = progress.processed + rows.length;
  const finished = processed >= total;
  await ctx.repos.finalizations.save({
    weekId,
    total,
    processed,
    finishedAt: finished ? ctx.now() : null,
  });
  if (finished) console.log(`weekly results finalized week=${weekId} total=${total}`);
  return finished;
}

/** ジョブ: 前週・前々週の結果を確定する（Cron が止まっていた場合も、近い週から取り戻す） */
export async function runFinalizeJob(ctx: DomainContext) {
  const current = currentWeekId(ctx);
  const done: string[] = [];
  for (const weekId of [addWeeks(current, -2), addWeeks(current, -1)]) {
    if (await finalizeWeek(ctx, weekId)) done.push(weekId);
  }
  return { finalized: done };
}

/** ジョブ: 保存期間を過ぎた挑戦の操作ログ・成績・確定結果を消す */
export async function runWeeklyPurgeJob(ctx: DomainContext) {
  const cutoff = addWeeks(currentWeekId(ctx), -WEEKLY_CONFIG.results.retentionWeeks);
  const attempts = await ctx.repos.attempts.deleteWeeksBefore(cutoff);
  const results = await ctx.repos.attemptResults.deleteWeeksBefore(cutoff);
  const standings = await ctx.repos.standings.deleteWeeksBefore(cutoff);
  return { cutoff, attempts, results, standings };
}

/** 締め切り後で確定済みの週か（そうでなければ notPublished / tallying） */
async function loadFinishedWeek(ctx: DomainContext, weekId: string) {
  if (!isDateId(weekId)) throw new DomainError('badRequest');
  if (weekId >= currentWeekId(ctx)) throw new DomainError('notPublished');
  const week = await ctx.repos.weeks.find(weekId);
  if (!week) throw new DomainError('notFound');
  const progress = await ctx.repos.finalizations.find(weekId);
  if (progress?.finishedAt == null) throw new DomainError('tallying');
  return { week, total: progress.total };
}

const toEntry = (row: StandingRow, me: PlayerRecord | null): RankingEntry => ({
  rank: row.rank,
  displayName: row.displayName,
  shiftsCleared: row.shiftsCleared,
  score: row.score.text,
  daysPlayed: row.daysPlayed,
  isMe: row.playerId === me?.id,
});

export async function getResults(
  ctx: DomainContext,
  weekId: string,
  me: PlayerRecord | null,
): Promise<WeeklyResultsResponse> {
  const { week, total } = await loadFinishedWeek(ctx, weekId);
  const { top, around } = WEEKLY_CONFIG.results;
  // 非表示のプレイヤーは表示から除く（順位は確定したまま。除いた分は次の行で埋める）
  const visibleTop = (await ctx.repos.standings.list(weekId, 1, top * 2))
    .filter((r) => !r.hidden)
    .slice(0, top);
  const mine = me ? await ctx.repos.standings.find(weekId, me.id) : null;
  const aroundRows =
    mine && !mine.hidden
      ? (
          await ctx.repos.standings.list(weekId, Math.max(1, mine.rank - around), around * 2 + 1)
        ).filter((r) => !r.hidden || r.playerId === mine.playerId)
      : [];
  return {
    weekId,
    number: week.number,
    provisional: false,
    total,
    top: visibleTop.map((r) => toEntry(r, me)),
    around: aroundRows.map((r) => toEntry(r, me)),
    me:
      mine && !mine.hidden
        ? {
            rank: mine.rank,
            topPercent: mine.topPercentMilli / 1000,
            shiftsCleared: mine.shiftsCleared,
            score: mine.score.text,
            daysPlayed: mine.daysPlayed,
          }
        : null,
    weekSecret: await deriveWeekSecret(ctx.config.masterSecret, weekId),
  };
}

/** 上位の挑戦のリプレイ（操作ログ・本番シード）。締め切り後・確定済みの週の上位 100 位まで */
export async function getReplay(
  ctx: DomainContext,
  weekId: string,
  rank: number,
): Promise<ReplayResponse> {
  if (!Number.isSafeInteger(rank) || rank < 1 || rank > WEEKLY_CONFIG.results.top) {
    throw new DomainError('badRequest');
  }
  const { week } = await loadFinishedWeek(ctx, weekId);
  const row = (await ctx.repos.standings.list(weekId, rank, 1))[0];
  if (!row || row.rank !== rank || row.hidden || !week.config) throw new DomainError('notFound');
  const attempt = await ctx.repos.attempts.find(weekId, row.dayId, row.playerId);
  if (!attempt) throw new DomainError('notFound');
  return {
    weekId,
    rank,
    displayName: row.displayName,
    dayId: row.dayId,
    config: week.config,
    candidate: week.candidate,
    fallback: week.fallback,
    ops: attempt.ops,
    commitSeeds: await commitSeedsFor(ctx.config.masterSecret, weekId, attempt.ops.length),
  };
}

/** 結果が確定した週の一覧（新しい順。保存期間内） */
export async function getLatest(ctx: DomainContext): Promise<WeeklyLatestResponse> {
  return {
    finished: await ctx.repos.finalizations.listFinished(WEEKLY_CONFIG.results.retentionWeeks),
  };
}
