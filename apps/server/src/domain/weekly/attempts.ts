/**
 * 週替わりチャレンジの挑戦（今週の情報・開始・途中経過・本番）
 *
 * 流れ:
 *   1. current … 今週の RunConfig・シードの証明・今日の日の ID・自分の今週の状況を返す（今週が開いていなければ開く）
 *   2. start   … 今日の挑戦を始める。1日1回（DB の一意制約）
 *   3. commit  … 前回の本番以降の操作ログを送る → サーバーで再生・本番 → 本番シードと結果を返す
 *                クライアントは返ってきたシードで simulate を実行し、演出を再生する
 * 挑戦は「始めた日」のものとして数える。本番は、その日（最終日なら週）の締め切り＋猶予まで受け付ける。
 * 途中で閉じても、受付期間内なら再開できる（確定済みの操作ログとシードを返す）。
 */
import type {
  CommitResponse,
  WeeklyAttemptView,
  WeeklyInfo,
  WeeklyMe,
} from '@chain-factory/shared';
import { compareRankKey, toScoreColumns } from '@chain-factory/shared';
import {
  getBestChain,
  getTotalShipped,
  isRunOp,
  SIM_VERSION,
  scoreToString,
  weeklyRunSeed,
  type RunOp,
} from '@chain-factory/sim';
import { SERVER_LIMITS } from '../../config/server';
import { WEEKLY_CONFIG } from '../../config/weekly';
import type { AttemptRecord, BestRecord, PlayerRecord, WeekRecord } from '../../repositories/types';
import { DomainError, type DomainContext } from '../context';
import { dayIdAt, dayWindow, isDateId } from './calendar';
import { commitSeedsFor } from './secret';
import { rebuildState, verifyAndCommit } from './verify';
import { currentWeekId, openWeek } from './weeks';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isRunOpList(value: unknown): value is RunOp[] {
  return (
    Array.isArray(value) && value.length <= SERVER_LIMITS.maxOpsPerShift && value.every(isRunOp)
  );
}

/** その週のランシード（候補番号・代替設定で変わる） */
export function runSeedOf(week: WeekRecord): number {
  return weeklyRunSeed(week.id, week.fallback ? -1 : week.candidate);
}

/** 今週（開いている週）を取得する。今週以外の週の ID なら challengeClosed / notFound */
async function loadCurrentWeek(ctx: DomainContext, weekId: string): Promise<WeekRecord> {
  if (!isDateId(weekId)) throw new DomainError('badRequest');
  const current = currentWeekId(ctx);
  if (weekId > current) throw new DomainError('notFound');
  if (weekId < current) throw new DomainError('challengeClosed');
  return openWeek(ctx, weekId);
}

/** 挑戦の本番を受け付ける締め切り（その日の締め切りと週の締め切りの早い方 ＋ 猶予） */
export function commitDeadline(ctx: DomainContext, week: WeekRecord, dayId: string): number {
  const dayClose = dayWindow(dayId, ctx.config.offsetMinutes).closesAt;
  return Math.min(dayClose, week.closesAt) + WEEKLY_CONFIG.graceMs;
}

async function toView(ctx: DomainContext, a: AttemptRecord): Promise<WeeklyAttemptView> {
  return {
    weekId: a.weekId,
    dayId: a.dayId,
    ops: a.ops,
    commitSeeds: await commitSeedsFor(ctx.config.masterSecret, a.weekId, a.shiftIndex),
    status: a.status,
  };
}

/** 自分の今週の状況 */
async function meOf(ctx: DomainContext, weekId: string, player: PlayerRecord, today: string) {
  const attempts = await ctx.repos.attempts.listByPlayer(weekId, player.id);
  const days = await Promise.all(
    attempts.map(async (a) => {
      const r = await ctx.repos.attemptResults.find(weekId, a.dayId, player.id);
      return {
        dayId: a.dayId,
        status: a.status,
        shiftsCleared: r?.shiftsCleared ?? 0,
        score: r?.score.text ?? '0',
      };
    }),
  );
  const best = await ctx.repos.bests.find(weekId, player.id);
  const todays = attempts.find((a) => a.dayId === today);
  const me: WeeklyMe = {
    best: best
      ? { dayId: best.dayId, shiftsCleared: best.shiftsCleared, score: best.score.text }
      : null,
    days,
    today: todays ? todays.status : 'none',
  };
  return me;
}

export async function getCurrentWeek(
  ctx: DomainContext,
  player: PlayerRecord | null,
): Promise<WeeklyInfo> {
  const week = await openWeek(ctx, currentWeekId(ctx));
  const now = ctx.now();
  const today = dayIdAt(now, ctx.config.offsetMinutes);
  return {
    weekId: week.id,
    number: week.number,
    config: week.config!,
    candidate: week.candidate,
    fallback: week.fallback,
    seedCommitment: week.seedCommitment,
    opensAt: week.opensAt,
    closesAt: week.closesAt,
    today,
    nextDayAt: dayWindow(today, ctx.config.offsetMinutes).closesAt,
    serverNow: now,
    me: player ? await meOf(ctx, week.id, player, today) : null,
  };
}

/** 今日の挑戦を始める。今日すでに始めていれば alreadyPlayed（再開は getAttempt で行う） */
export async function startAttempt(
  ctx: DomainContext,
  player: PlayerRecord,
  weekId: string,
): Promise<WeeklyAttemptView> {
  const week = await loadCurrentWeek(ctx, weekId);
  const now = ctx.now();
  if (now < week.opensAt || now >= week.closesAt) throw new DomainError('challengeClosed');
  const attempt: AttemptRecord = {
    weekId,
    dayId: dayIdAt(now, ctx.config.offsetMinutes),
    playerId: player.id,
    ops: [],
    shiftIndex: 0,
    status: 'playing',
    startedAt: now,
    updatedAt: now,
  };
  if (!(await ctx.repos.attempts.create(attempt))) throw new DomainError('alreadyPlayed');
  return toView(ctx, attempt);
}

export async function getAttempt(
  ctx: DomainContext,
  player: PlayerRecord,
  weekId: string,
  dayId: string,
): Promise<WeeklyAttemptView> {
  if (!isDateId(weekId) || !isDateId(dayId)) throw new DomainError('badRequest');
  const attempt = await ctx.repos.attempts.find(weekId, dayId, player.id);
  if (!attempt) throw new DomainError('notFound');
  return toView(ctx, attempt);
}

/** 新しい成績が今週のベストより上か（同じ成績なら、提出の早い今のベストのまま） */
function beats(next: BestRecord, current: BestRecord | null): boolean {
  return !current || compareRankKey(next, current) < 0;
}

/** 本番: 操作ログを検証してシフトを確定する */
export async function commitAttempt(
  ctx: DomainContext,
  player: PlayerRecord,
  weekId: string,
  dayId: string,
  body: unknown,
): Promise<CommitResponse> {
  if (!isRecord(body)) throw new DomainError('badRequest');
  // sim のバージョンが違うと同じ操作でも結果が変わりうるので、先に弾く（クライアントに再読み込みを促す）
  if (typeof body.simVersion !== 'string') throw new DomainError('badRequest');
  if (body.simVersion !== SIM_VERSION) throw new DomainError('simVersionMismatch');
  if (!isNonNegativeSafeInteger(body.shiftIndex)) throw new DomainError('badRequest');
  if (!isRunOpList(body.ops)) throw new DomainError('invalidSubmission');
  if (!isDateId(weekId) || !isDateId(dayId)) throw new DomainError('badRequest');
  const shiftIndex = body.shiftIndex;
  const ops = body.ops;

  const week = await ctx.repos.weeks.find(weekId);
  if (!week?.config) throw new DomainError('notFound');
  if (week.simVersion !== SIM_VERSION) throw new DomainError('simVersionMismatch');

  const attempt = await ctx.repos.attempts.find(weekId, dayId, player.id);
  if (!attempt) throw new DomainError('notFound');
  if (ctx.now() >= commitDeadline(ctx, week, dayId)) throw new DomainError('challengeClosed');
  if (attempt.status !== 'playing' || shiftIndex !== attempt.shiftIndex) {
    throw new DomainError('badRequest', `shift mismatch: ${String(shiftIndex)}`);
  }

  const seeds = await commitSeedsFor(ctx.config.masterSecret, weekId, attempt.shiftIndex + 1);
  const current = rebuildState(runSeedOf(week), week.config, attempt.ops, seeds);
  const verified = verifyAndCommit(current, ops, seeds[attempt.shiftIndex]!);
  if (!verified.ok) {
    // 詳しい理由はサーバーのログにだけ残す（クライアントに不正のやり方の手がかりを与えない）
    console.warn(`invalid submission week=${weekId} player=${player.id} ${verified.reason}`);
    throw new DomainError('invalidSubmission', verified.reason);
  }

  const { state, result, outcome } = verified.commit;
  const finished = state.phase !== 'building';
  const now = ctx.now();
  const updated: AttemptRecord = {
    ...attempt,
    ops: [...attempt.ops, ops],
    shiftIndex: attempt.shiftIndex + 1,
    status: finished ? 'finished' : 'playing',
    updatedAt: now,
  };
  // 同じシフトの同時提出は、後から来た方が失敗する
  if (!(await ctx.repos.attempts.update(updated, attempt.shiftIndex))) {
    throw new DomainError('badRequest', 'concurrent commit');
  }

  // 途中までの成績も記録する（シフト数 → 合計出荷量の順で並ぶので、途中で閉じても不利にはならない）
  const attemptResult = {
    weekId,
    dayId,
    playerId: player.id,
    shiftsCleared: state.history.filter((h) => h.cleared).length,
    score: toScoreColumns(getTotalShipped(state)),
    maxChain: getBestChain(state),
    submittedAt: now,
  };
  await ctx.repos.attemptResults.put(attemptResult);

  // 今週のベストと参加日数（挑戦した日の数）
  const daysPlayed = (await ctx.repos.attempts.listByPlayer(weekId, player.id)).length;
  const currentBest = await ctx.repos.bests.find(weekId, player.id);
  const candidate: BestRecord = { ...attemptResult, daysPlayed };
  let best = currentBest;
  if (beats(candidate, currentBest)) {
    best = candidate;
    await ctx.repos.bests.put(candidate);
  } else if (currentBest && currentBest.daysPlayed !== daysPlayed) {
    best = { ...currentBest, daysPlayed };
    await ctx.repos.bests.put(best);
  }
  await ctx.repos.shopStats.add(weekId, verified.stats);

  return {
    seed: seeds[attempt.shiftIndex]!,
    score: scoreToString(result.score),
    cleared: outcome.cleared,
    finished,
    // この挑戦が今週のベストか（同じ挑戦の前のシフトでベストになっていた場合も含む）
    newBest: best?.dayId === dayId,
  };
}
