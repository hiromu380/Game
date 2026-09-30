/**
 * デイリーの API 処理（今日の情報・開始・進行状況・本番・秘密値の公開）
 *
 * 流れ:
 *   1. today   … 今日の RunConfig と seedCommitment を返す（なければその場で生成）
 *   2. start   … 挑戦を始める。1日1回（DB の一意制約）
 *   3. commit  … 前回の本番以降の操作ログを送る → サーバーで再生・本番 → 本番シードと結果を返す
 *                クライアントは返ってきたシードで simulate を実行し、演出を再生する
 *   4. reveal  … 締め切り後に dailySecret を公開（seedCommitment と照合できる）
 * 途中で閉じても session で再開できる（確定済みの操作ログとシードを返す）。
 */
import type {
  CommitResponse,
  DailyInfo,
  DailySessionView,
  RevealResponse,
} from '@chain-factory/shared';
import { toScoreColumns } from '@chain-factory/shared';
import {
  getBestChain,
  getTotalShipped,
  isRunOp,
  SIM_VERSION,
  scoreToString,
  type RunOp,
} from '@chain-factory/sim';
import { SERVER_LIMITS } from '../../config/server';
import type { PlayerRecord, SessionRecord } from '../../repositories/types';
import { DomainError, type DomainContext } from '../context';
import { dailyIdAt, isDailyId } from './calendar';
import { ensureDaily } from './dailyJob';
import { deriveCommitSeed, deriveDailySecret } from './dailySecret';
import { rebuildState, verifyAndCommit } from './verify';

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

/** デイリーを取得する。今日の分はなければ作る。未来の日・存在しない日は notFound */
async function loadDaily(ctx: DomainContext, dailyId: string) {
  if (!isDailyId(dailyId)) throw new DomainError('badRequest');
  const today = dailyIdAt(ctx.now(), ctx.config.dailyOffsetMinutes);
  if (dailyId > today) throw new DomainError('notFound');
  const daily =
    dailyId === today ? await ensureDaily(ctx, dailyId) : await ctx.repos.dailies.find(dailyId);
  if (!daily) throw new DomainError('notFound');
  return daily;
}

/** 受付期間中でなければ dailyClosed */
function assertOpen(ctx: DomainContext, daily: { opensAt: number; closesAt: number }) {
  const now = ctx.now();
  if (now < daily.opensAt || now >= daily.closesAt) throw new DomainError('dailyClosed');
}

async function commitSeedsFor(ctx: DomainContext, dailyId: string, count: number) {
  const secret = await deriveDailySecret(ctx.config.masterSecret, dailyId);
  const seeds: number[] = [];
  for (let i = 0; i < count; i++) seeds.push(await deriveCommitSeed(secret, i));
  return seeds;
}

async function toView(ctx: DomainContext, s: SessionRecord): Promise<DailySessionView> {
  return {
    dailyId: s.dailyId,
    ranked: s.ranked,
    ops: s.ops,
    commitSeeds: await commitSeedsFor(ctx, s.dailyId, s.shiftIndex),
    status: s.status,
  };
}

export async function getToday(ctx: DomainContext): Promise<DailyInfo> {
  const daily = await loadDaily(ctx, dailyIdAt(ctx.now(), ctx.config.dailyOffsetMinutes));
  return {
    dailyId: daily.id,
    number: daily.number,
    config: daily.config,
    seedCommitment: daily.seedCommitment,
    opensAt: daily.opensAt,
    closesAt: daily.closesAt,
  };
}

/** 挑戦を始める。すでに始めていれば alreadyPlayed（再開は getSession で行う） */
export async function startDaily(
  ctx: DomainContext,
  player: PlayerRecord,
  dailyId: string,
): Promise<DailySessionView> {
  const daily = await loadDaily(ctx, dailyId);
  assertOpen(ctx, daily);
  const session: SessionRecord = {
    dailyId,
    playerId: player.id,
    ops: [],
    shiftIndex: 0,
    status: 'playing',
    ranked: true,
    updatedAt: ctx.now(),
  };
  if (!(await ctx.repos.sessions.create(session))) throw new DomainError('alreadyPlayed');
  return toView(ctx, session);
}

export async function getSession(
  ctx: DomainContext,
  player: PlayerRecord,
  dailyId: string,
): Promise<DailySessionView> {
  if (!isDailyId(dailyId)) throw new DomainError('badRequest');
  const session = await ctx.repos.sessions.find(dailyId, player.id);
  if (!session) throw new DomainError('notFound');
  return toView(ctx, session);
}

/** 本番: 操作ログを検証してシフトを確定する */
export async function commitDaily(
  ctx: DomainContext,
  player: PlayerRecord,
  dailyId: string,
  body: unknown,
): Promise<CommitResponse> {
  if (!isRecord(body)) throw new DomainError('badRequest');
  // sim のバージョンが違うと同じ操作でも結果が変わりうるので、先に弾く（クライアントに再読み込みを促す）
  if (typeof body.simVersion !== 'string') throw new DomainError('badRequest');
  if (body.simVersion !== SIM_VERSION) throw new DomainError('simVersionMismatch');
  if (!isNonNegativeSafeInteger(body.shiftIndex)) throw new DomainError('badRequest');
  if (!isRunOpList(body.ops)) throw new DomainError('invalidSubmission');
  const shiftIndex = body.shiftIndex;
  const ops = body.ops;

  const daily = await loadDaily(ctx, dailyId);
  if (daily.simVersion !== SIM_VERSION) throw new DomainError('simVersionMismatch');
  assertOpen(ctx, daily);

  const session = await ctx.repos.sessions.find(dailyId, player.id);
  if (!session) throw new DomainError('notFound');
  if (session.status !== 'playing' || shiftIndex !== session.shiftIndex) {
    throw new DomainError('badRequest', `shift mismatch: ${String(shiftIndex)}`);
  }

  const seeds = await commitSeedsFor(ctx, dailyId, session.shiftIndex + 1);
  const current = rebuildState(dailyId, daily.config, session.ops, seeds);
  const verified = verifyAndCommit(current, ops, seeds[session.shiftIndex]!);
  if (!verified.ok) {
    // 詳しい理由はサーバーのログにだけ残す（クライアントに不正のやり方の手がかりを与えない）
    console.warn(`invalid submission daily=${dailyId} player=${player.id} ${verified.reason}`);
    throw new DomainError('invalidSubmission', verified.reason);
  }

  const { state, result, outcome } = verified.commit;
  const finished = state.phase !== 'building';
  const now = ctx.now();
  const updated: SessionRecord = {
    ...session,
    ops: [...session.ops, ops],
    shiftIndex: session.shiftIndex + 1,
    status: finished ? 'finished' : 'playing',
    updatedAt: now,
  };
  // 同じシフトの同時提出は、後から来た方が失敗する
  if (!(await ctx.repos.sessions.update(updated, session.shiftIndex))) {
    throw new DomainError('badRequest', 'concurrent commit');
  }

  if (session.ranked) {
    // 途中までの成績もランキングに載せる（シフト数 → 合計出荷量の順で並ぶので、途中で閉じても不利にはならない）
    await ctx.repos.results.put({
      dailyId,
      playerId: player.id,
      shiftsCleared: state.history.filter((h) => h.cleared).length,
      score: toScoreColumns(getTotalShipped(state)),
      maxChain: getBestChain(state),
      submittedAt: now,
    });
    await ctx.repos.shopStats.add(dailyId, verified.stats);
  }

  return {
    seed: seeds[session.shiftIndex]!,
    score: scoreToString(result.score),
    cleared: outcome.cleared,
    finished,
  };
}

/** 締め切り後に秘密値を公開する */
export async function revealDaily(ctx: DomainContext, dailyId: string): Promise<RevealResponse> {
  const daily = await loadDaily(ctx, dailyId);
  if (ctx.now() < daily.closesAt) throw new DomainError('notFound');
  return { dailyId, dailySecret: await deriveDailySecret(ctx.config.masterSecret, dailyId) };
}
