/**
 * カットシーンの一覧（シーンの定義は必要なときに読み込む）
 * シーンを足したら、ここに登録する（登録していないシーンは自動再生も思い出も出さない）
 */
import type { SceneId } from '../playback';
import type { Scene } from '../timeline';

export const SCENE_LOADERS: Partial<Record<SceneId, () => Promise<Scene>>> = {
  opening: () => import('./opening').then((m) => m.opening),
  interlude1: () => import('./interludes').then((m) => m.interlude1),
  interlude2: () => import('./interludes').then((m) => m.interlude2),
  gameOver: () => import('./gameOver').then((m) => m.gameOver),
  ending: () => import('./ending').then((m) => m.ending),
  demoTeaser: () => import('./demoTeaser').then((m) => m.demoTeaser),
};

/** 用意してあるシーン */
export const AVAILABLE_SCENES = Object.keys(SCENE_LOADERS) as SceneId[];
