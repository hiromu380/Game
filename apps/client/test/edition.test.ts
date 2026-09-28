/**
 * 体験版（VITE_EDITION=demo）の通常ラン: 初期パーツ・7×7・延長戦なし（メタ進行を反映しない）
 */
import { BALANCE, createInitialMeta, PART_IDS } from '@chain-factory/sim';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('体験版の通常ラン', () => {
  it('メタ進行（解放・工場拡張）があっても初期パーツ・7×7、延長戦なし', async () => {
    vi.stubEnv('VITE_EDITION', 'demo');
    vi.resetModules();
    const { startNormalRun } = await import('../src/state/newRun');
    const { EDITION_CONFIG } = await import('../src/config/edition');
    expect(EDITION_CONFIG.showStoreLink).toBe(true);

    const veteran = { ...createInitialMeta(), unlockedParts: [...PART_IDS], boardLevel: 2 };
    const run = startNormalRun(1, veteran, undefined);
    expect(run.config.board).toEqual(BALANCE.board);
    expect(run.config.overtimeAllowed).toBe(false);
    const pool = run.config.economy.shopPool.map((p) => p.partId);
    expect(new Set(pool)).toEqual(
      new Set(BALANCE.meta.initialUnlocked.filter((id) => id !== 'switch')),
    );
  });

  it('製品版はメタ進行を反映する', async () => {
    vi.stubEnv('VITE_EDITION', 'full');
    vi.resetModules();
    const { startNormalRun } = await import('../src/state/newRun');
    const veteran = { ...createInitialMeta(), unlockedParts: [...PART_IDS], boardLevel: 2 };
    expect(startNormalRun(1, veteran, undefined).config.board.width).toBeGreaterThan(
      BALANCE.board.width,
    );
  });
});
