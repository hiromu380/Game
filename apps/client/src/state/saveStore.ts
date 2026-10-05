/**
 * 進行中のランとメタ進行を localStorage に保存・読み込みする
 * 形式とバージョン管理は @chain-factory/shared の save/ を参照
 */
import { createSave, migrateSave, type SaveData, type StoryProgress } from '@chain-factory/shared';
import {
  createInitialAchievements,
  createInitialMeta,
  type AchievementProgress,
  type MetaProgress,
  type RunState,
} from '@chain-factory/sim';
import { appStorage } from '../storage';

export const SAVE_STORAGE_KEY = 'chain-factory:save';

/** テストで差し替えられるよう、必要な機能だけの Storage 型 */
export type SimpleStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** 既定の保存先（Web 版は localStorage、デスクトップ版はファイル。storage/index.ts） */
function defaultStorage(): SimpleStorage | null {
  return appStorage();
}

/** 保存されたデータを読み込む（古い形式は最新形式へ変換）。無い・壊れている場合は null */
export function loadSave(storage = defaultStorage()): SaveData | null {
  if (!storage) return null;
  try {
    const text = storage.getItem(SAVE_STORAGE_KEY);
    if (!text) return null;
    return migrateSave(JSON.parse(text));
  } catch {
    return null;
  }
}

/**
 * 保存する。省略した項目は保存済みのものを引き継ぐ
 * （週替わり・練習中は進行中の通常ランを保存し直さず、メタ進行・実績だけを更新するため）
 */
export function saveGame(
  update: {
    run?: RunState | null;
    meta?: MetaProgress;
    achievements?: AchievementProgress;
    story?: StoryProgress;
  },
  storage = defaultStorage(),
): void {
  if (!storage) return;
  try {
    const saved =
      update.run === undefined || !update.meta || !update.achievements || !update.story
        ? loadSave(storage)
        : null;
    const data = createSave(
      update.run !== undefined ? update.run : (saved?.run ?? null),
      update.meta ?? saved?.meta ?? createInitialMeta(),
      update.achievements ?? saved?.achievements ?? createInitialAchievements(),
      update.story ?? saved?.story ?? { seen: [] },
    );
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 容量不足などで保存できなくてもゲームは続行する
  }
}

/**
 * 続きから遊べる保存済みのランを読み込む
 * 終わったラン（ノルマ未達・諦めた）は続きがないので null（タイトルは「はじめから」になる）
 */
export function loadRun(storage = defaultStorage()): RunState | null {
  const run = loadSave(storage)?.run ?? null;
  return run && run.phase !== 'failed' ? run : null;
}

/** 見たカットシーン（セーブがなければ何も見ていない） */
export function loadSeenScenes(storage = defaultStorage()): string[] {
  return loadSave(storage)?.story.seen ?? [];
}

/** カットシーンを見た記録を残す（すでに見ていれば何もしない） */
export function markSceneSeen(id: string, storage = defaultStorage()): void {
  const seen = loadSeenScenes(storage);
  if (seen.includes(id)) return;
  saveGame({ story: { seen: [...seen, id] } }, storage);
}
