/**
 * 実績の解除判定（純粋関数）
 *
 * 判定の材料（AchievementContext）は、呼び出す場面ごとに分かれている:
 * - shift: 本番のシフトを確定した直後（出荷量・連鎖・ボス・延長戦・イベントログ）
 * - meta:  ランが終わってメタ進行を更新した後（累計・回数・工場拡張・解放パーツ）。起動時にも判定して取りこぼしを拾う
 * - daily: デイリーの本番がサーバーで確定した後・ランキングを受け取った後（サーバーで検証済みの結果だけ）
 * 材料がない条件は判定しない（false）。
 */
import { BALANCE, type Balance, type PartParams } from '../balance';
import { SCORE_ZERO, scoreCompare, scoreFromString, scoreMul, type Score } from '../core/score';
import type { MetaProgress } from '../meta/types';
import { getCurrentRules } from '../run/shift';
import type { CommitResult, RunState, ShiftRecord } from '../run/types';
import type { SimEvent, SimResult } from '../types';
import {
  ACHIEVEMENTS,
  type AchievementCondition,
  type AchievementId,
  type AchievementStatId,
} from './definitions';

/** セーブに持つ実績の状態（Steam がオフラインでも、あとで送り直せるように解除済みを覚えておく） */
export interface AchievementProgress {
  unlocked: AchievementId[];
  /** デイリーに参加した日数（本番を1回以上確定した日） */
  dailyDays: number;
  /** 最後に数えたデイリー（同じ日を二重に数えないため） */
  lastDailyId: string | null;
}

export function createInitialAchievements(): AchievementProgress {
  return { unlocked: [], dailyDays: 0, lastDailyId: null };
}

export interface AchievementContext {
  shift?: {
    record: ShiftRecord;
    result: SimResult;
    /** このシフトに使ったルールのパラメーター（ポンコツロボの最大倍率の判定に使う） */
    params: PartParams;
    /** 延長戦でクリアしたシフト数（このシフトを含む） */
    overtimeCleared: number;
  };
  meta?: MetaProgress;
  daily?: {
    /** このデイリーで全シフトをクリアした */
    cleared?: boolean;
    /** ランキングの上位何 % か */
    topPercent?: number;
  };
}

/** 本番の確定（commitShift の前のラン・結果）から、シフトの判定材料を作る */
export function shiftContextOf(
  before: RunState,
  committed: Pick<CommitResult, 'state' | 'result'>,
): NonNullable<AchievementContext['shift']> {
  const { history } = committed.state;
  return {
    record: history[history.length - 1]!,
    result: committed.result,
    params: getCurrentRules(before).params,
    overtimeCleared: history.slice(before.config.baseShiftCount).filter((h) => h.cleared).length,
  };
}

/**
 * デイリーの本番を確定したことを記録する（その日の最初の確定でだけ日数を足す）
 * ランキング対象（その日の最初の挑戦）のときだけ呼ぶ
 */
export function recordDailyParticipation(
  progress: AchievementProgress,
  dailyId: string,
): AchievementProgress {
  if (progress.lastDailyId === dailyId) return progress;
  return { ...progress, dailyDays: progress.dailyDays + 1, lastDailyId: dailyId };
}

/** まだ解除していない実績のうち、条件を満たしたもの（定義順） */
export function evaluateAchievements(
  progress: AchievementProgress,
  context: AchievementContext,
  balance: Balance = BALANCE,
): AchievementId[] {
  return ACHIEVEMENTS.filter(
    (a) => !progress.unlocked.includes(a.id) && isMet(a.condition, progress, context, balance),
  ).map((a) => a.id);
}

/** 解除を記録する（重複は足さない） */
export function unlockAchievements(
  progress: AchievementProgress,
  ids: readonly AchievementId[],
): AchievementProgress {
  const added = ids.filter((id) => !progress.unlocked.includes(id));
  return added.length === 0
    ? progress
    : { ...progress, unlocked: [...progress.unlocked, ...added] };
}

/** Steam 統計に送る値（回数系だけ） */
export function achievementStats(
  meta: MetaProgress,
  progress: AchievementProgress,
): Record<AchievementStatId, number> {
  return {
    STAT_RUNS: meta.records.runsPlayed,
    STAT_FULL_CLEARS: meta.records.clears,
    STAT_DAILY_DAYS: progress.dailyDays,
  };
}

const atLeast = (value: Score, threshold: string) =>
  scoreCompare(value, scoreFromString(threshold)) >= 0;

function isMet(
  condition: AchievementCondition,
  progress: AchievementProgress,
  { shift, meta, daily }: AchievementContext,
  balance: Balance,
): boolean {
  switch (condition.kind) {
    case 'shiftScore':
      return !!shift && atLeast(scoreFromString(shift.record.score), condition.atLeast);
    case 'shiftZero':
      return !!shift && scoreCompare(scoreFromString(shift.record.score), SCORE_ZERO) === 0;
    case 'shiftCleared':
      if (!shift?.record.cleared) return false;
      if (condition.boss === undefined) return true;
      if (condition.boss === 'any') return shift.record.boss !== null;
      return shift.record.boss === condition.boss;
    case 'chain':
      return !!shift && shift.record.chainCount >= condition.atLeast;
    case 'junkbotStreak':
      return !!shift && junkbotMaxStreak(shift.result.events, shift.params) >= condition.count;
    case 'overtimeCleared':
      return !!shift && shift.overtimeCleared >= condition.atLeast;
    case 'record':
      if (!meta) return false;
      return condition.record === 'totalShipped'
        ? atLeast(scoreFromString(meta.records.totalShipped), condition.atLeast)
        : meta.records[condition.record] >= condition.atLeast;
    case 'boardLevel':
      return !!meta && meta.boardLevel >= condition.atLeast;
    case 'allParts':
      return !!meta && balance.meta.partUnlocks.every((u) => meta.unlockedParts.includes(u.partId));
    case 'dailyDays':
      return progress.dailyDays >= condition.atLeast;
    case 'dailyCleared':
      return daily?.cleared === true;
    case 'dailyTopPercent':
      return daily?.topPercent !== undefined && daily.topPercent <= condition.atMost;
  }
}

/**
 * ポンコツロボが最大倍率を続けて出した最長の回数（1回の稼働のイベントログから数える）
 *
 * ポンコツロボの発動（activate）の直後に、同じ tick・同じマスから出た信号（emit）の値を、受けた信号の値と比べる。
 * 倍率は「最大の段数 ÷ 割る数」なので、出た値 × 割る数 = 受けた値 × 最大の段数 なら最大倍率（切り捨ての影響なし）。
 * 値が 0 の信号は倍率がわからないので、連続を途切れさせる。
 */
export function junkbotMaxStreak(events: readonly SimEvent[], params: PartParams): number {
  const valueOf = new Map<number, Score>();
  const pending: { tick: number; x: number; y: number; incoming: Score }[] = [];
  let streak = 0;
  let best = 0;
  for (const e of events) {
    if (e.type === 'activate' && e.partId === 'junkbot') {
      pending.push({
        tick: e.tick,
        x: e.x,
        y: e.y,
        incoming: valueOf.get(e.signalId) ?? SCORE_ZERO,
      });
    } else if (e.type === 'emit') {
      valueOf.set(e.signalId, e.value);
      const index = pending.findIndex((p) => p.tick === e.tick && p.x === e.x && p.y === e.y);
      if (index < 0) continue;
      const { incoming } = pending.splice(index, 1)[0]!;
      const isMax =
        scoreCompare(incoming, SCORE_ZERO) > 0 &&
        scoreCompare(
          scoreMul(e.value, params.junkbotStepDivisor),
          scoreMul(incoming, params.junkbotMaxSteps),
        ) === 0;
      streak = isMax ? streak + 1 : 0;
      best = Math.max(best, streak);
    }
  }
  return best;
}
