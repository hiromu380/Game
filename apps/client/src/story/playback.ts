/**
 * カットシーンをいつ出すか（純粋関数）
 *
 * - 出す場面: 初めてのラン（オープニング）・1日をクリアしたとき（幕間。最終日は省いてエンディングへ）・
 *   全シフトクリア（エンディング。体験版は予告）・ノルマ未達（ゲームオーバー）
 * - 初回だけ自動で再生し、2回目以降は出さない（タイトルの「思い出」から見直せる）
 * - 週替わり・練習・延長戦では出さない（全員同じ条件で、テンポを優先する）
 */
import type { RunState } from '@chain-factory/sim';
import type { Edition } from '../config/edition';
import type { PlayMode } from '../state/gameReducer';

export const SCENE_IDS = [
  'opening',
  'interlude1',
  'interlude2',
  'gameOver',
  'ending',
  'demoTeaser',
] as const;
export type SceneId = (typeof SCENE_IDS)[number];

/** カットシーンのきっかけ */
export type StoryTrigger =
  | { kind: 'newRun' }
  /** day: クリアした日（1 始まり） */
  | { kind: 'dayCleared'; day: number }
  | { kind: 'runCleared' }
  | { kind: 'runFailed' };

/** 本番の確定の前後のランから、きっかけを求める（なければ null） */
export function triggerAfterCommit(before: RunState, after: RunState): StoryTrigger | null {
  if (before.phase !== 'building') return null;
  if (after.phase === 'failed') return { kind: 'runFailed' };
  // 延長戦（全シフトのあとに足した日）では出さない
  if (before.overtime || before.shiftIndex >= before.config.baseShiftCount) return null;
  if (after.phase === 'cleared') return { kind: 'runCleared' };
  const perDay = before.config.shiftsPerDay;
  const dayBefore = Math.floor(before.shiftIndex / perDay);
  const dayAfter = Math.floor(after.shiftIndex / perDay);
  return dayAfter > dayBefore ? { kind: 'dayCleared', day: dayBefore + 1 } : null;
}

/** きっかけに対応するシーン（体験版はエンディングの代わりに予告） */
export function sceneForTrigger(trigger: StoryTrigger, edition: Edition): SceneId | null {
  switch (trigger.kind) {
    case 'newRun':
      return 'opening';
    case 'dayCleared':
      // 最終日は幕間を省き、そのままエンディングへ（ここでは日数の上限を見ず、用意した幕間だけ出す）
      return trigger.day === 1 ? 'interlude1' : trigger.day === 2 ? 'interlude2' : null;
    case 'runCleared':
      return edition === 'demo' ? 'demoTeaser' : 'ending';
    case 'runFailed':
      return 'gameOver';
  }
}

/** 自動で再生するシーン（出さないなら null） */
export function autoPlayScene(
  trigger: StoryTrigger | null,
  context: {
    mode: PlayMode['kind'];
    edition: Edition;
    seen: readonly string[];
    available: readonly string[];
  },
): SceneId | null {
  if (!trigger || context.mode !== 'normal') return null;
  const scene = sceneForTrigger(trigger, context.edition);
  if (!scene || context.seen.includes(scene) || !context.available.includes(scene)) return null;
  return scene;
}

/** 思い出（見直し）に並べるシーン: 見たものだけ。体験版ではエンディングを出さない */
export function memoryScenes(
  seen: readonly string[],
  edition: Edition,
  available: readonly string[],
): SceneId[] {
  return SCENE_IDS.filter(
    (id) => seen.includes(id) && available.includes(id) && !(edition === 'demo' && id === 'ending'),
  );
}
