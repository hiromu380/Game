/**
 * 進行中のランを localStorage に保存・読み込みする
 * 形式とバージョン管理は @chain-factory/shared の save.ts を参照
 */
import { createSave, migrateSave } from '@chain-factory/shared';
import type { RunState } from '@chain-factory/sim';

export const SAVE_STORAGE_KEY = 'chain-factory:save';

/** テストで差し替えられるよう、必要な機能だけの Storage 型 */
export type SimpleStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStorage(): SimpleStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveRun(run: RunState | null, storage = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(createSave(run)));
  } catch {
    // 容量不足などで保存できなくてもゲームは続行する
  }
}

/** 保存されたランを読み込む。無い・壊れている・未対応バージョンなら null */
export function loadRun(storage = defaultStorage()): RunState | null {
  if (!storage) return null;
  try {
    const text = storage.getItem(SAVE_STORAGE_KEY);
    if (!text) return null;
    return migrateSave(JSON.parse(text))?.run ?? null;
  } catch {
    return null;
  }
}
