/**
 * 実績: 定義の整合性・場面ごとの解除判定・ポンコツロボの連続最大倍率の検出
 */
import { describe, expect, it } from 'vitest';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_IDS,
  achievementStats,
  BALANCE,
  commitShift,
  createInitialAchievements,
  createInitialMeta,
  createRun,
  DEFAULT_RULES,
  evaluateAchievements,
  getCurrentRules,
  junkbotMaxStreak,
  recordDailyParticipation,
  scoreOf,
  shiftContextOf,
  simulate,
  unlockAchievements,
  type AchievementContext,
  type ShiftRecord,
  type SimEvent,
  type SimResult,
} from '../src';
import { board } from './helpers';

const params = DEFAULT_RULES.params;
const emptyResult: SimResult = {
  score: scoreOf(0),
  income: 0,
  events: [],
  stats: {
    chainCount: 0,
    activatedParts: 0,
    shipCount: 0,
    floorApplied: 0,
    maxValue: scoreOf(0),
    ticks: 0,
    halted: null,
  },
};

function shiftContext(
  record: Partial<ShiftRecord>,
  extra: { events?: SimEvent[]; overtimeCleared?: number } = {},
): AchievementContext {
  return {
    shift: {
      record: {
        shiftIndex: 0,
        score: '0',
        quota: 1,
        cleared: false,
        chainCount: 0,
        income: 0,
        boss: null,
        ...record,
      },
      result: { ...emptyResult, events: extra.events ?? [] },
      params,
      overtimeCleared: extra.overtimeCleared ?? 0,
    },
  };
}

const evaluate = (context: AchievementContext, progress = createInitialAchievements()) =>
  evaluateAchievements(progress, context);

describe('実績の定義', () => {
  it('30個・ID は Steamworks の API 名の形で重複なし', () => {
    expect(ACHIEVEMENTS).toHaveLength(30);
    expect(new Set(ACHIEVEMENT_IDS).size).toBe(30);
    for (const id of ACHIEVEMENT_IDS) expect(id).toMatch(/^ACH_[A-Z0-9_]+$/);
  });
});

describe('シフト確定時の判定', () => {
  it('出荷量・クリア・連鎖', () => {
    expect(evaluate(shiftContext({ score: '1', cleared: true, chainCount: 30 }))).toEqual([
      'ACH_FIRST_SHIP',
      'ACH_FIRST_SHIFT',
      'ACH_CHAIN_25',
    ]);
    expect(evaluate(shiftContext({ score: '1000000000' }))).toEqual([
      'ACH_FIRST_SHIP',
      'ACH_SHIFT_1M',
      'ACH_SHIFT_1B',
    ]);
  });

  it('ボスのシフトはクリアしたときだけ（夜勤明け + そのボスの実績）', () => {
    expect(evaluate(shiftContext({ score: '5', boss: 'lowOil', cleared: false }))).toEqual([
      'ACH_FIRST_SHIP',
    ]);
    expect(evaluate(shiftContext({ score: '5', boss: 'lowOil', cleared: true }))).toEqual([
      'ACH_FIRST_SHIP',
      'ACH_FIRST_SHIFT',
      'ACH_FIRST_NIGHT',
      'ACH_BOSS_LOWOIL',
    ]);
  });

  it('出荷量 0 の隠し実績・延長戦', () => {
    expect(evaluate(shiftContext({ score: '0' }))).toEqual(['ACH_ZERO']);
    expect(evaluate(shiftContext({ score: '0' }, { overtimeCleared: 9 }))).toEqual([
      'ACH_OVERTIME_3',
      'ACH_OVERTIME_9',
      'ACH_ZERO',
    ]);
  });

  it('解除済みの実績は返さない', () => {
    const progress = unlockAchievements(createInitialAchievements(), ['ACH_FIRST_SHIP']);
    expect(evaluate(shiftContext({ score: '1' }), progress)).toEqual([]);
    expect(unlockAchievements(progress, ['ACH_FIRST_SHIP'])).toBe(progress);
  });
});

describe('本番の確定からの判定材料', () => {
  it('commitShift の結果から、記録・パラメーター・延長戦のクリア数を作る', () => {
    const before = createRun(1);
    const committed = commitShift(before);
    if ('error' in committed) throw new Error(committed.error);
    const context = shiftContextOf(before, committed);
    expect(context.record).toEqual(committed.state.history[0]);
    expect(context.params).toEqual(getCurrentRules(before).params);
    expect(context.overtimeCleared).toBe(0);
    expect(evaluate({ shift: context })).toContain('ACH_ZERO'); // 空の盤面は出荷量 0
  });
});

describe('メタ進行の判定', () => {
  it('回数・累計・工場拡張・全パーツ', () => {
    const meta = createInitialMeta();
    expect(evaluate({ meta })).toEqual([]);
    const grown = {
      unlockedParts: [...meta.unlockedParts, ...BALANCE.meta.partUnlocks.map((u) => u.partId)],
      boardLevel: 2,
      records: {
        ...meta.records,
        clears: 10,
        runsPlayed: 50,
        totalShipped: '1000000000',
      },
    };
    expect(evaluate({ meta: grown })).toEqual([
      'ACH_FULL_CLEAR',
      'ACH_FULL_CLEAR_10',
      'ACH_TOTAL_1B',
      'ACH_RUNS_10',
      'ACH_RUNS_50',
      'ACH_FACTORY_8',
      'ACH_FACTORY_9',
      'ACH_ALL_PARTS',
    ]);
    expect(achievementStats(grown, createInitialAchievements())).toEqual({
      STAT_RUNS: 50,
      STAT_FULL_CLEARS: 10,
      STAT_DAILY_DAYS: 0,
    });
  });
});

describe('デイリーの判定', () => {
  it('参加日数は同じ日を二重に数えない', () => {
    let progress = createInitialAchievements();
    progress = recordDailyParticipation(progress, '2026-10-01');
    progress = recordDailyParticipation(progress, '2026-10-01');
    expect(progress.dailyDays).toBe(1);
    expect(evaluate({}, progress)).toEqual(['ACH_DAILY_FIRST']);
    for (let d = 2; d <= 7; d++) progress = recordDailyParticipation(progress, `2026-10-0${d}`);
    expect(progress.dailyDays).toBe(7);
    expect(evaluate({}, progress)).toContain('ACH_DAILY_7');
  });

  it('全シフトクリア・上位 10%', () => {
    expect(evaluate({ daily: { cleared: true, topPercent: 10 } })).toEqual([
      'ACH_DAILY_CLEAR',
      'ACH_DAILY_TOP10',
    ]);
    expect(evaluate({ daily: { cleared: false, topPercent: 10.5 } })).toEqual([]);
  });
});

describe('ポンコツロボの連続最大倍率', () => {
  const activate = (tick: number, signalId: number): SimEvent => ({
    tick,
    type: 'activate',
    signalId,
    x: 1,
    y: 0,
    partId: 'junkbot',
  });
  const emit = (tick: number, signalId: number, value: number): SimEvent => ({
    tick,
    type: 'emit',
    signalId,
    x: 1,
    y: 0,
    dir: 2,
    value: scoreOf(value),
  });
  const start: SimEvent = {
    tick: 0,
    type: 'emit',
    signalId: 0,
    x: 0,
    y: 0,
    dir: 2,
    value: scoreOf(2),
  };

  it('×3 が3回続けば 3、途中で途切れたら数え直す', () => {
    const three = [
      start,
      activate(1, 0),
      emit(1, 1, 6),
      activate(2, 1),
      emit(2, 2, 18),
      activate(3, 2),
      emit(3, 3, 54),
    ];
    expect(junkbotMaxStreak(three, params)).toBe(3);
    const broken = [
      start,
      activate(1, 0),
      emit(1, 1, 6),
      activate(2, 1),
      emit(2, 2, 12),
      activate(3, 2),
      emit(3, 3, 36),
    ];
    expect(junkbotMaxStreak(broken, params)).toBe(1);
  });

  it('実際のシミュレーションのイベントログから ×3 を見つけられる', () => {
    // スイッチ → ポンコツロボ（方向も倍率もシードで決まる）。値 1 × 3 = 3 が出たシードでだけ 1 になる
    const b = board(['S> J>']);
    let found = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const result = simulate({ board: b, seed, rules: DEFAULT_RULES });
      const emitted3 = result.events.some(
        (e) => e.type === 'emit' && e.x === 1 && e.value === scoreOf(3),
      );
      expect(junkbotMaxStreak(result.events, params)).toBe(emitted3 ? 1 : 0);
      if (emitted3) found++;
    }
    expect(found).toBeGreaterThan(0);
  });
});
