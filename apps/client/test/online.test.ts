/**
 * オンライン: 身元の保存と、デイリーの再開（操作ログ + 本番シードからの復元）
 */
import type { DailyInfo } from '@chain-factory/shared';
import {
  buildWeeklyConfig,
  commitShift,
  createRunWithConfig,
  weeklyRunSeed,
  replayOps,
  type RunOp,
} from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { buildDailyRun, buildPracticeRun } from '../src/online/dailyRun';
import { IDENTITY_STORAGE_KEY, loadIdentity, saveIdentity } from '../src/online/identity';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

const DAY = '2026-10-01';
const info: DailyInfo = {
  dailyId: DAY,
  number: 1,
  config: buildWeeklyConfig({ weekId: DAY }),
  seedCommitment: 'x',
  opensAt: 0,
  closesAt: 1,
};

describe('身元の保存', () => {
  it('保存して読み込める・壊れたデータや古い形式は null', () => {
    const storage = memoryStorage();
    expect(loadIdentity(storage)).toBeNull();
    saveIdentity({ version: 1, playerId: 'p', token: 'p.t', displayName: '' }, storage);
    expect(loadIdentity(storage)).toMatchObject({ playerId: 'p', token: 'p.t' });
    storage.setItem(IDENTITY_STORAGE_KEY, '{broken');
    expect(loadIdentity(storage)).toBeNull();
    storage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify({ version: 99, playerId: 'p' }));
    expect(loadIdentity(storage)).toBeNull();
  });
});

describe('デイリーの再開', () => {
  it('確定済みの操作ログとシードから、続けて遊んだ場合と同じ状態を作れる', () => {
    const ops: RunOp[] = [{ op: 'reroll' }];
    // 続けて遊んだ場合
    const played = replayOps(createRunWithConfig(weeklyRunSeed(DAY), info.config), ops);
    if (!played.ok) throw new Error('replay failed');
    const committed = commitShift(played.state, { seed: 42 });
    if ('error' in committed) throw new Error(committed.error);

    const resumed = buildDailyRun(info, {
      dailyId: DAY,
      ranked: true,
      ops: [ops],
      commitSeeds: [42],
      status: 'playing',
    });
    expect(resumed).toEqual(committed.state);
    expect(buildDailyRun(info, null).shiftIndex).toBe(0);
  });

  it('練習は同じ盤面・ショップで、本番シードをクライアントで作る', () => {
    const practice = buildPracticeRun(info);
    expect(practice.shop).toEqual(buildDailyRun(info, null).shop);
    expect(practice.config.commitSeedMode).toBe('derived');
    expect('error' in commitShift(practice)).toBe(false);
  });
});
