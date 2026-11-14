/**
 * 週替わりチャレンジのランをクライアントで組み立てる（新規・再開・練習）
 *
 * 再開は「確定済みの操作ログ」と「そのシフトの本番シード」をサーバーから受け取り、
 * 最初から再生して現在の状態を作る（サーバーの検証と同じ手順。ローカルには保存しない）。
 */
import type { WeeklyAttemptView, WeeklyInfo } from '@chain-factory/shared';
import {
  commitShift,
  createRunWithConfig,
  weeklyRunSeed,
  replayOps,
  type RunState,
} from '@chain-factory/sim';

/** その週のランシード（盤面の候補番号・代替設定で変わる。サーバーと同じ導出） */
export function weeklySeedOf(info: Pick<WeeklyInfo, 'weekId' | 'candidate' | 'fallback'>): number {
  return weeklyRunSeed(info.weekId, info.fallback ? -1 : info.candidate);
}

/** 本番（ランキング対象）のラン。attempt があれば続きから */
export function buildWeeklyRun(info: WeeklyInfo, attempt: WeeklyAttemptView | null): RunState {
  let state = createRunWithConfig(weeklySeedOf(info), info.config);
  for (const [shiftIndex, ops] of (attempt?.ops ?? []).entries()) {
    const replayed = replayOps(state, ops);
    if (!replayed.ok) throw new Error(`replay failed at shift ${shiftIndex}`);
    const committed = commitShift(replayed.state, { seed: attempt!.commitSeeds[shiftIndex]! });
    if ('error' in committed) throw new Error(committed.error);
    state = committed.state;
  }
  return state;
}

/**
 * 練習: 同じ盤面・同じ相場・同じ特殊ルールで、本番シードだけクライアントで作る。
 * 何度でも遊べるがランキングには載らない
 */
export function buildPracticeRun(info: WeeklyInfo): RunState {
  const config = { ...info.config, commitSeedMode: 'derived' as const, mode: 'practice' as const };
  return createRunWithConfig(weeklySeedOf(info), config);
}
