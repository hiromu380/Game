/**
 * オンライン: 身元の保存、週替わりの再開（操作ログ + 本番シードからの復元）、結果発表の既読、週の日付
 */
import type { WeeklyInfo } from '@chain-factory/shared';
import {
  buildWeeklyConfig,
  commitShift,
  createRunWithConfig,
  weeklyRunSeed,
  replayOps,
  type RunOp,
} from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { buildPracticeRun, buildWeeklyRun, weeklySeedOf } from '../src/online/weeklyRun';
import { hasUnreadResults, loadResultsSeen, markResultsSeen } from '../src/online/resultsSeen';
import { addDays, daysOfWeek, monthDay, weekdayOf } from '../src/online/weekDates';
import { IDENTITY_STORAGE_KEY, loadIdentity, saveIdentity } from '../src/online/identity';

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
}

const WEEK = '2026-09-28';
const DAY = '2026-10-01';
const info: WeeklyInfo = {
  weekId: WEEK,
  number: 1,
  config: buildWeeklyConfig({ weekId: WEEK, candidate: 2 }),
  candidate: 2,
  fallback: false,
  seedCommitment: 'x',
  opensAt: 0,
  closesAt: 1,
  today: DAY,
  nextDayAt: 1,
  serverNow: 0,
  me: null,
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

describe('週替わりの再開', () => {
  it('確定済みの操作ログとシードから、続けて遊んだ場合と同じ状態を作れる', () => {
    const ops: RunOp[] = [{ op: 'reroll' }];
    // 続けて遊んだ場合
    const played = replayOps(createRunWithConfig(weeklyRunSeed(WEEK, 2), info.config), ops);
    if (!played.ok) throw new Error('replay failed');
    const committed = commitShift(played.state, { seed: 42 });
    if ('error' in committed) throw new Error(committed.error);

    const resumed = buildWeeklyRun(info, {
      weekId: WEEK,
      dayId: DAY,
      ops: [ops],
      commitSeeds: [42],
      status: 'playing',
    });
    expect(resumed).toEqual(committed.state);
    expect(buildWeeklyRun(info, null).shiftIndex).toBe(0);
  });

  it('練習は同じ盤面・ショップで、本番シードをクライアントで作る', () => {
    const practice = buildPracticeRun(info);
    expect(practice.shop).toEqual(buildWeeklyRun(info, null).shop);
    expect(practice.config.commitSeedMode).toBe('derived');
    expect('error' in commitShift(practice)).toBe(false);
  });
});

describe('ランシード', () => {
  it('候補番号・代替設定でサーバーと同じランシードになる', () => {
    expect(weeklySeedOf(info)).toBe(weeklyRunSeed(WEEK, 2));
    expect(weeklySeedOf({ ...info, fallback: true })).toBe(weeklyRunSeed(WEEK, -1));
  });
});

describe('結果発表の既読', () => {
  it('見た週を記録し、新しい週だけを未読にする（古い週を見ても戻さない）', () => {
    const storage = memoryStorage();
    expect(loadResultsSeen(storage)).toBeNull();
    expect(hasUnreadResults(WEEK, null)).toBe(true);
    expect(hasUnreadResults(undefined, null)).toBe(false);
    markResultsSeen(WEEK, storage);
    markResultsSeen('2026-09-21', storage);
    expect(loadResultsSeen(storage)).toBe(WEEK);
    expect(hasUnreadResults(WEEK, loadResultsSeen(storage))).toBe(false);
    expect(hasUnreadResults('2026-10-05', loadResultsSeen(storage))).toBe(true);
    storage.setItem('chain-factory.weekly.resultsSeen', 'broken');
    expect(loadResultsSeen(storage)).toBeNull();
  });
});

describe('週の日付', () => {
  it('週の7日・曜日・月日（月またぎ・年またぎ）', () => {
    expect(daysOfWeek(WEEK)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(weekdayOf(WEEK)).toBe(1);
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
    expect(addDays(WEEK, -7)).toBe('2026-09-21');
    expect(monthDay('2026-10-04')).toEqual({ month: 10, day: 4 });
  });
});
