import { describe, expect, it } from 'vitest';
import {
  applyRunToMeta,
  BALANCE,
  createInitialMeta,
  createRun,
  createWeeklyRun,
  maxAscension,
  type RunState,
} from '../src';

const cleared = (run: RunState): RunState => ({
  ...run,
  phase: 'cleared',
  history: [
    { shiftIndex: 0, score: '1', quota: 1, cleared: true, chainCount: 1, income: 0, boss: null },
  ],
});

describe('残業レベル', () => {
  it('Lv0 は通常のまま', () => {
    expect(createRun(3, { ascension: 0 }).config).toEqual(createRun(3).config);
  });

  it('レベルの条件を重ねる（ノルマは掛け算・切り上げ、予算・価格・リロール・候補数は足し算）', () => {
    const base = createRun(3).config;
    const lv10 = createRun(3, { ascension: 10 }).config;
    expect(lv10.ascension).toBe(10);
    // 125% × 125% × 150% = 234.375%
    expect(lv10.shifts.map((s) => s.quota)).toEqual(
      base.shifts.map((s) => Math.ceil((s.quota * 234375) / 100000)),
    );
    expect(lv10.shifts.map((s) => s.budget)).toEqual(
      base.shifts.map((s) => Math.max(0, s.budget - 2)),
    );
    expect(lv10.overtime.budget).toBe(base.overtime.budget - 2);
    expect(lv10.economy.prices.gear).toBe(base.economy.prices.gear + 1);
    expect(lv10.economy.prices.switch).toBe(0);
    expect(lv10.economy.reroll.costStep).toBe(base.economy.reroll.costStep + 1);
    expect(lv10.relics!.choices).toBe(base.relics!.choices - 1);
    expect(lv10.dayEvents!.choices).toBe(base.dayEvents!.choices - 1);
    // ボーナス床は1枚減る（0〜2枚 → 0〜1枚）
    expect(lv10.bonusFloors!.countWeights).toEqual([
      base.bonusFloors!.countWeights[0]! + base.bonusFloors!.countWeights[1]!,
      base.bonusFloors!.countWeights[2]!,
    ]);
  });

  it('上限より大きいレベルは上限として扱う。週替わりには重ねない', () => {
    expect(createRun(3, { ascension: 99 }).config).toEqual(
      createRun(3, { ascension: maxAscension(BALANCE) }).config,
    );
    expect(createWeeklyRun('2026-W40', { practice: true }).config.ascension).toBeUndefined();
  });

  it('選べる最高のレベルでクリアすると次を解放して選ぶ。低いレベルのクリアでは解放しない', () => {
    const meta = createInitialMeta();
    const first = applyRunToMeta(meta, cleared(createRun(1)));
    expect(first.meta.ascension).toEqual({ unlocked: 1, selected: 1 });
    expect(first.unlocks).toContainEqual({ kind: 'ascension', level: 1 });

    const again = applyRunToMeta(first.meta, cleared(createRun(2)));
    expect(again.meta.ascension).toEqual({ unlocked: 1, selected: 1 });

    const failed = applyRunToMeta(first.meta, {
      ...cleared(createRun(3, { ascension: 1 })),
      phase: 'failed',
    });
    expect(failed.meta.ascension.unlocked).toBe(1);

    const top = { ...meta, ascension: { unlocked: maxAscension(BALANCE), selected: 10 } };
    expect(
      applyRunToMeta(top, cleared(createRun(4, { ascension: 10 }))).meta.ascension.unlocked,
    ).toBe(maxAscension(BALANCE));
  });
});
