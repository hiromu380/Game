/**
 * 体験版 → 製品版のセーブの引き継ぎ
 */
import { createSave } from '@chain-factory/shared';
import { createInitialMeta, createRun } from '@chain-factory/sim';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SAVE_KEY = 'chain-factory:save';

function memoryLocalStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

/** 体験版で2回遊んだセーブ（進行中のランあり） */
function demoSave(): string {
  const meta = createInitialMeta();
  const played = { ...meta, records: { ...meta.records, runsPlayed: 2, clears: 1 } };
  return JSON.stringify(createSave(createRun(1), played));
}

let storage: ReturnType<typeof memoryLocalStorage>;

beforeEach(() => {
  vi.resetModules();
  storage = memoryLocalStorage();
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());

const load = async (demo: string | null) => {
  vi.stubGlobal('window', { chainFactory: { readDemoSave: async () => demo } });
  return import('../src/state/demoImport');
};

describe('体験版のデータの引き継ぎ', () => {
  it('製品版のセーブがなく、体験版で遊んでいれば引き継げる（ランは引き継がない）', async () => {
    const { findDemoSaveToImport, answerDemoImport } = await load(demoSave());
    const meta = await findDemoSaveToImport();
    expect(meta?.records.runsPlayed).toBe(2);
    answerDemoImport(meta);
    const saved = JSON.parse(storage.getItem(SAVE_KEY)!);
    expect(saved.meta.records.clears).toBe(1);
    expect(saved.run).toBeNull();
    // 答えたあとは聞かない（製品版のセーブができたため）
    expect(await findDemoSaveToImport()).toBeNull();
  });

  it('引き継がないを選んでも製品版のセーブを作り、2回目は聞かない', async () => {
    const { findDemoSaveToImport, answerDemoImport } = await load(demoSave());
    answerDemoImport(null);
    expect(JSON.parse(storage.getItem(SAVE_KEY)!).meta.records.runsPlayed).toBe(0);
    expect(await findDemoSaveToImport()).toBeNull();
  });

  it('体験版のセーブがない・壊れている・1回も遊んでいないときは聞かない', async () => {
    for (const raw of [null, '{broken', JSON.stringify(createSave(null))]) {
      vi.resetModules();
      const { findDemoSaveToImport } = await load(raw);
      expect(await findDemoSaveToImport()).toBeNull();
    }
  });
});
