/**
 * 進行中のランとメタ進行を localStorage に保存・読み込みする
 * 形式とバージョン管理は @chain-factory/shared の save/ を参照
 */
import { createSave, migrateSave, type SaveData } from '@chain-factory/shared';
import { createInitialMeta, type MetaProgress, type RunState } from '@chain-factory/sim';
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
 * ランを保存する。メタ進行は省略すると保存済みのものを引き継ぐ
 */
export function saveGame(
  run: RunState | null,
  meta?: MetaProgress,
  storage = defaultStorage(),
): void {
  if (!storage) return;
  try {
    const currentMeta = meta ?? loadSave(storage)?.meta ?? createInitialMeta();
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(createSave(run, currentMeta)));
  } catch {
    // 容量不足などで保存できなくてもゲームは続行する
  }
}

/** 保存されたランだけを読み込む */
export function loadRun(storage = defaultStorage()): RunState | null {
  return loadSave(storage)?.run ?? null;
}
