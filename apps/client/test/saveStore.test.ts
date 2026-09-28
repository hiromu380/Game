import { SAVE_VERSION } from '@chain-factory/shared';
import { createRun } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { loadRun, SAVE_STORAGE_KEY, saveGame, type SimpleStorage } from '../src/state/saveStore';

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
    saveGame(run, undefined, storage);
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
});
