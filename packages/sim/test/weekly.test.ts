/**
 * 週替わりチャレンジの設定・本番シードの外部指定・操作ログの再生のテスト
 */
import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  buildWeeklyConfig,
  commitShift,
  createWeeklyRun,
  createRun,
  weeklyRunSeed,
  PART_IDS,
  replayOps,
  SIM_VERSION,
  startOvertime,
  type RunOp,
} from '../src';

describe('週替わりの RunConfig', () => {
  it('同じ週の ID なら全員同じ設定・同じショップになる', () => {
    expect(buildWeeklyConfig({ weekId: '2026-09-28' })).toEqual(
      buildWeeklyConfig({ weekId: '2026-09-28' }),
    );
    expect(createWeeklyRun('2026-09-28').shop).toEqual(createWeeklyRun('2026-09-28').shop);
    expect(weeklyRunSeed('2026-09-28')).not.toBe(weeklyRunSeed('2026-09-29'));
  });

  it('メタ進行なし（全パーツ・7×7）・3シフト・延長戦なし・本番シードは外部指定', () => {
    const config = buildWeeklyConfig({ weekId: '2026-09-28' });
    const shopParts = config.economy.shopPool.map((p) => p.partId);
    expect(new Set(shopParts)).toEqual(new Set(PART_IDS.filter((id) => id !== 'switch')));
    expect(config.board).toEqual(BALANCE.board);
    expect(config.shifts).toEqual(BALANCE.weekly.shifts);
    expect(config.overtimeAllowed).toBe(false);
    expect(config.commitSeedMode).toBe('external');
    expect(config.mode).toBe('weekly');
    expect(config.simVersion).toBe(SIM_VERSION);
  });

  it('今週の特殊ルールが1つかかる（候補の中から ID で決まる）', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 30; d++) {
      const rule = buildWeeklyConfig({
        weekId: `2026-10-${String(d).padStart(2, '0')}`,
      }).globalModifier;
      expect(rule).not.toBeNull();
      expect(BALANCE.weekly.specialRules).toContain(rule!.id);
      seen.add(rule!.id);
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('相場価格を差し込める', () => {
    const config = buildWeeklyConfig({ weekId: '2026-09-28', prices: { gear: 9 } });
    expect(config.economy.prices.gear).toBe(9);
    expect(config.economy.prices.press).toBe(BALANCE.parts.press.price);
  });

  it('候補番号を変えると盤面（ランシード）が変わり、代替設定はやさしい帯で特殊ルールなし', () => {
    expect(weeklyRunSeed('2026-10-05', 1)).not.toBe(weeklyRunSeed('2026-10-05', 0));
    expect(createWeeklyRun('2026-10-05', { candidate: 1 }).shop).toEqual(
      createWeeklyRun('2026-10-05', { candidate: 1 }).shop,
    );
    const fallback = buildWeeklyConfig({ weekId: '2026-10-05', fallback: true });
    expect(fallback.globalModifier).toBeNull();
    expect(fallback.stages!.days[0]).not.toEqual(
      buildWeeklyConfig({ weekId: '2026-10-05' }).stages!.days[0],
    );
  });

  it('練習モードは本番シードをクライアントで作る', () => {
    const config = buildWeeklyConfig({ weekId: '2026-09-28', practice: true });
    expect(config.commitSeedMode).toBe('derived');
    expect(config.mode).toBe('practice');
  });
});

describe('本番シードの外部指定', () => {
  it('週替わりはシードを渡さないと本番を実行できない', () => {
    expect(commitShift(createWeeklyRun('2026-09-28'))).toEqual({ error: 'seedRequired' });
  });

  it('シードを渡せば実行でき、同じシードなら同じ結果になる', () => {
    const run = createWeeklyRun('2026-09-28');
    const a = commitShift(run, { seed: 123 });
    const b = commitShift(run, { seed: 123 });
    expect('error' in a).toBe(false);
    expect(a).toEqual(b);
  });

  it('デイリーは全クリアしても延長戦に進めない', () => {
    const run = { ...createWeeklyRun('2026-09-28'), phase: 'cleared' as const };
    expect(startOvertime(run)).toBeNull();
  });

  it('通常ランは従来どおりシードなしで実行できる', () => {
    expect('error' in commitShift(createRun(1))).toBe(false);
  });
});

describe('操作ログの再生', () => {
  // リロールを止める特殊ルール（部品不足）に当たらない週を使う
  const run = createWeeklyRun('2026-10-12');

  it('正しい操作ログを再生すると、同じ操作を直接行ったのと同じ状態になる', () => {
    const ops: RunOp[] = [
      { op: 'place', partId: 'switch', x: 0, y: 3, dir: 1 },
      { op: 'place', partId: 'dock', x: 2, y: 3, dir: 1 },
      { op: 'rotate', x: 2, y: 3 },
      { op: 'return', x: 2, y: 3 },
      { op: 'place', partId: 'dock', x: 1, y: 3, dir: 1 },
      { op: 'reroll' },
      { op: 'buy', offerIndex: 0 },
    ];
    const replayed = replayOps(run, ops);
    expect(replayed.ok).toBe(true);
    if (!replayed.ok) return;
    expect(replayed.state.board.cells[3 * 7 + 1]).toEqual({ id: 'dock', dir: 1 });
    expect(replayed.state.rerollCount).toBe(1);
    expect(replayed.state.budget).toBeLessThan(run.budget);
  });

  it('不正な操作（予算超過・ショップにない商品・盤面外・手持ちにない・壊れたデータ）は位置と理由つきで拒否する', () => {
    const poor = { ...run, budget: 0 };
    expect(replayOps(poor, [{ op: 'buy', offerIndex: 0 }])).toEqual({
      ok: false,
      index: 0,
      error: 'notEnoughBudget',
    });
    expect(replayOps(run, [{ op: 'buy', offerIndex: 99 }])).toMatchObject({
      ok: false,
      error: 'offerNotFound',
    });
    expect(replayOps(run, [{ op: 'place', partId: 'switch', x: 9, y: 0, dir: 1 }])).toMatchObject({
      ok: false,
      error: 'outOfBoard',
    });
    expect(
      replayOps(run, [{ op: 'place', partId: 'chainMeter', x: 0, y: 0, dir: 1 }]),
    ).toMatchObject({
      ok: false,
      error: 'notInInventory',
    });
    expect(replayOps(run, [{ op: 'reroll' }, { op: 'teleport' }])).toEqual({
      ok: false,
      index: 1,
      error: 'invalidOp',
    });
    expect(replayOps(run, [{ op: 'place', partId: 'dock', x: 1.5, y: 0, dir: 1 }])).toMatchObject({
      ok: false,
      error: 'invalidOp',
    });
  });
});
