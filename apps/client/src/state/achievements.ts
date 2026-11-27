/**
 * 実績の状態の更新（ゲームの進行 → 判定 → 解除の記録）
 *
 * 判定そのものは sim の純粋関数（evaluateAchievements）。ここでは「どの場面で、どの材料を渡すか」を決める。
 * Steam への送信は画面側（App）がプラットフォーム経由で行う（reducer を純粋関数に保つため）。
 * 体験版では実績を無効にする（CLAUDE.md「Steam 連携」）。
 */
import {
  createInitialAchievements,
  evaluateAchievements,
  recordWeeklyParticipation,
  shiftContextOf,
  unlockAchievements,
  type AchievementContext,
  type AchievementProgress,
  type CommitResult,
  type MetaProgress,
  type RunState,
} from '@chain-factory/sim';
import { EDITION_CONFIG } from '../config/edition';
import type { PlayMode } from './gameReducer';
import { loadSave, saveGame } from './saveStore';

function apply(progress: AchievementProgress, context: AchievementContext): AchievementProgress {
  return unlockAchievements(progress, evaluateAchievements(progress, context));
}

/**
 * 本番を確定したとき
 * - どのモードでも: 出荷量・連鎖・ボス・延長戦（週替わりはサーバーで検証済みのシードで確定している）
 * - 通常ラン: 更新後のメタ進行（ランが終わったとき）
 * - 週替わりの本番: 参加日数・全シフトクリア
 */
export function achievementsAfterCommit(
  progress: AchievementProgress,
  input: {
    mode: PlayMode;
    before: RunState;
    committed: Pick<CommitResult, 'state' | 'result'>;
    /** 通常ランでメタ進行を更新した場合の、更新後のメタ進行 */
    meta?: MetaProgress;
  },
): AchievementProgress {
  if (!EDITION_CONFIG.achievements) return progress;
  const { mode, before, committed } = input;
  let next = progress;
  if (mode.kind === 'weekly') next = recordWeeklyParticipation(next, mode.dayId);
  return apply(next, {
    shift: shiftContextOf(before, committed),
    meta: input.meta,
    weekly: mode.kind === 'weekly' ? { cleared: committed.state.phase === 'cleared' } : undefined,
  });
}

/** 確定した結果発表で自分の順位を受け取ったとき（暫定ランキングでは判定しない） */
export function achievementsAfterRanking(
  progress: AchievementProgress,
  topPercent: number,
): AchievementProgress {
  if (!EDITION_CONFIG.achievements) return progress;
  return apply(progress, { weekly: { topPercent } });
}

/** 起動時: メタ進行の記録で満たしている実績を解除する（セーブの移行直後・取りこぼしの回収） */
export function achievementsOnLoad(
  progress: AchievementProgress,
  meta: MetaProgress,
): AchievementProgress {
  if (!EDITION_CONFIG.achievements) return progress;
  return apply(progress, { meta });
}

/**
 * タイトル画面からランキングを見たとき（ゲーム画面の状態がないので、セーブに直接記録する。
 * Steam へはゲーム画面に入ったときにまとめて送る）
 */
export function recordRankingToSave(topPercent: number): void {
  const current = loadSave()?.achievements ?? createInitialAchievements();
  const next = achievementsAfterRanking(current, topPercent);
  if (next !== current) saveGame({ achievements: next });
}
