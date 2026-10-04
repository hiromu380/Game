/**
 * カットシーンの一覧（シーンの定義は必要なときに読み込む）
 * シーンを足したら、ここに登録する（登録していないシーンは自動再生も思い出も出さない）
 */
import type { SceneId } from '../playback';
import type { Scene } from '../timeline';

export const SCENE_LOADERS: Partial<Record<SceneId, () => Promise<Scene>>> = {};

/** 用意してあるシーン */
export const AVAILABLE_SCENES = Object.keys(SCENE_LOADERS) as SceneId[];
