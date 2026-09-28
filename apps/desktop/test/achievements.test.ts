/**
 * 実績まわり: メインプロセスは定義済みの実績だけを送る・統計の ID が sim と一致・Steamworks 用の一覧が最新
 */
import { readFileSync } from 'node:fs';
import { IPC_CHANNELS, STAT_IDS } from '@chain-factory/shared';
import {
  ACHIEVEMENT_IDS,
  ACHIEVEMENTS,
  achievementStats,
  createInitialAchievements,
  createInitialMeta,
} from '@chain-factory/sim';
import { describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/main/config';
import { createHandlers } from '../src/main/ipc/handlers';
import { unavailableSteam } from '../src/main/steam/types';
import { buildAchievementsDoc, OUTPUT_PATH } from '../scripts/achievementsList';

describe('実績の送信（メインプロセス）', () => {
  it('定義済みの実績だけを Steam へ送る', async () => {
    const unlockAchievement = vi.fn(async () => true);
    const handlers = createHandlers(
      {
        store: { readAll: async () => ({}), write: async () => {} },
        steam: { ...unavailableSteam, available: true, unlockAchievement },
        openExternal: async () => {},
        achievementIds: new Set(ACHIEVEMENT_IDS),
      },
      { ...CONFIG, edition: 'full' },
    );
    const unlock = handlers[IPC_CHANNELS.unlockAchievement]!;
    expect(await unlock('ACH_FIRST_SHIP')).toBe(true);
    expect(await unlock('ACH_NOT_DEFINED')).toBe(false);
    expect(unlockAchievement).toHaveBeenCalledTimes(1);
  });
});

describe('定義の整合性', () => {
  it('Steam 統計の ID が sim の定義と一致する', () => {
    const stats = achievementStats(createInitialMeta(), createInitialAchievements());
    expect(Object.keys(stats).sort()).toEqual([...STAT_IDS].sort());
    for (const a of ACHIEVEMENTS) {
      if ('progressStat' in a) expect(STAT_IDS).toContain(a.progressStat);
    }
  });

  it('Steamworks 用の一覧（docs/ops/steam-achievements-list.md）が最新', () => {
    // 失敗したら: pnpm --filter @chain-factory/desktop achievements:export
    expect(readFileSync(OUTPUT_PATH, 'utf8')).toBe(buildAchievementsDoc());
  });
});
