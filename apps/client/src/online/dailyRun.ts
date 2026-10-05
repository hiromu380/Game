/**
 * デイリーのランをクライアントで組み立てる（新規・再開・練習）
 *
 * 再開は「確定済みの操作ログ」と「そのシフトの本番シード」をサーバーから受け取り、
 * 最初から再生して現在の状態を作る（サーバーの検証と同じ手順。ローカルには保存しない）。
 */
import type { DailyInfo, DailySessionView } from '@chain-factory/shared';
import {
  commitShift,
  createRunWithConfig,
  weeklyRunSeed,
  replayOps,
  type RunState,
} from '@chain-factory/sim';

/** 本番（ランキング対象）のラン。session があれば続きから */
export function buildDailyRun(info: DailyInfo, session: DailySessionView | null): RunState {
  let state = createRunWithConfig(weeklyRunSeed(info.dailyId), info.config);
  for (const [shiftIndex, ops] of (session?.ops ?? []).entries()) {
    const replayed = replayOps(state, ops);
    if (!replayed.ok) throw new Error(`replay failed at shift ${shiftIndex}`);
    const committed = commitShift(replayed.state, { seed: session!.commitSeeds[shiftIndex]! });
    if ('error' in committed) throw new Error(committed.error);
    state = committed.state;
  }
  return state;
}

/**
 * 練習: 同じ盤面・同じ相場・同じ特殊ルールで、本番シードだけクライアントで作る。
 * 何度でも遊べるがランキングには載らない
 */
export function buildPracticeRun(info: DailyInfo): RunState {
  const config = { ...info.config, commitSeedMode: 'derived' as const, mode: 'practice' as const };
  return createRunWithConfig(weeklyRunSeed(info.dailyId), config);
}
