/**
 * 保存先の抽象化: デスクトップ版（ファイル）と Web 版（localStorage）で、セーブを相互に読み書きできること
 */
import { createInitialMeta, createRun } from '@chain-factory/sim';
import { describe, expect, it, vi } from 'vitest';
import { loadIdentity, saveIdentity } from '../src/online/identity';
import { loadSave, SAVE_STORAGE_KEY, saveGame } from '../src/state/saveStore';
import { createDesktopStorage } from '../src/storage';

/** localStorage の代わり（Web 版） */
function memoryLocalStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    dump: () => Object.fromEntries(map),
  };
}

describe('デスクトップ版の保存先', () => {
  it('書き込みはメインプロセスへ送り、読み込みはメモリから同期的に返す', () => {
    const write = vi.fn(async () => {});
    const storage = createDesktopStorage({ write }, { 'chain-factory:settings': '{"a":1}' });
    expect(storage.getItem('chain-factory:settings')).toBe('{"a":1}');
    storage.setItem('chain-factory:save', 'x');
    expect(storage.getItem('chain-factory:save')).toBe('x');
    expect(write).toHaveBeenCalledWith('chain-factory:save', 'x');
  });

  it('許可されていないキーは保存しない（メインプロセスにも送らない）', () => {
    const write = vi.fn(async () => {});
    const storage = createDesktopStorage({ write }, {});
    storage.setItem('chain-factory:lang', 'en');
    expect(storage.getItem('chain-factory:lang')).toBeNull();
    expect(write).not.toHaveBeenCalled();
  });

  it('書き込みに失敗してもゲームは止まらない', () => {
    const storage = createDesktopStorage(
      { write: () => Promise.reject(new Error('disk full')) },
      {},
    );
    expect(() => storage.setItem('chain-factory:save', 'x')).not.toThrow();
  });
});

describe('セーブの相互運用（localStorage ⇄ ファイル）', () => {
  it('Web 版で保存したセーブをデスクトップ版で読める', () => {
    const web = memoryLocalStorage();
    const run = createRun(7);
    saveGame({ run, meta: createInitialMeta() }, web);
    // デスクトップ版のファイルの中身は localStorage の値と同じ文字列
    const desktop = createDesktopStorage({ write: async () => {} }, web.dump());
    expect(loadSave(desktop)?.run).toEqual(run);
  });

  it('デスクトップ版で保存したセーブを Web 版で読める', () => {
    const files: Record<string, string> = {};
    const desktop = createDesktopStorage(
      {
        write: async (key, value) => {
          files[key] = value;
        },
      },
      {},
    );
    const run = createRun(11);
    saveGame({ run, meta: createInitialMeta() }, desktop);
    const web = memoryLocalStorage();
    web.setItem(SAVE_STORAGE_KEY, files[SAVE_STORAGE_KEY]!);
    expect(loadSave(web)?.run).toEqual(run);
  });

  it('オンラインの身元もどちらでも読める', () => {
    const desktop = createDesktopStorage({ write: async () => {} }, {});
    saveIdentity({ version: 1, playerId: 'p', token: 'p.t', displayName: 'Bolt-0000' }, desktop);
    expect(loadIdentity(desktop)?.playerId).toBe('p');
  });
});
