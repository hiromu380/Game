import { SAVE_VERSION } from '@chain-factory/shared';
import { createRun } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import {
  loadRun,
  loadSeenScenes,
  markSceneSeen,
  SAVE_STORAGE_KEY,
  saveGame,
  type SimpleStorage,
} from '../src/state/saveStore';

/** テスト用のメモリ上の Storage */
function memoryStorage(): SimpleStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe('セーブ/ロード', () => {
  it('保存したランをそのまま読み込める（バージョン番号付き）', () => {
    const storage = memoryStorage();
    const run = createRun(99);
    saveGame({ run }, storage);
    expect(JSON.parse(storage.data.get(SAVE_STORAGE_KEY)!).version).toBe(SAVE_VERSION);
    expect(loadRun(storage)).toEqual(run);
  });

  it('壊れたデータや未対応バージョンは null', () => {
    const storage = memoryStorage();
    storage.setItem(SAVE_STORAGE_KEY, '{broken');
    expect(loadRun(storage)).toBeNull();
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify({ version: 999, run: {} }));
    expect(loadRun(storage)).toBeNull();
  });

  it('終わったラン（ノルマ未達・諦めた）は続きから遊べないので null', () => {
    const storage = memoryStorage();
    saveGame({ run: { ...createRun(99), phase: 'failed' } }, storage);
    expect(loadRun(storage)).toBeNull();
  });
});

describe('見たカットシーンの記録', () => {
  it('見たシーンを足し、ほかの保存（ラン）を消さない。同じシーンは二重に記録しない', () => {
    const storage = memoryStorage();
    expect(loadSeenScenes(storage)).toEqual([]);
    const run = createRun(5);
    saveGame({ run }, storage);
    markSceneSeen('opening', storage);
    markSceneSeen('opening', storage);
    markSceneSeen('interlude1', storage);
    expect(loadSeenScenes(storage)).toEqual(['opening', 'interlude1']);
    expect(loadRun(storage)).toEqual(run);
    // ランを保存し直しても、見たシーンは残る
    saveGame({ run: null }, storage);
    expect(loadSeenScenes(storage)).toEqual(['opening', 'interlude1']);
  });
});
