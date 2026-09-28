/**
 * ボスシフト（夜）の修正ルールのテスト
 */
import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  BOSS_MODIFIERS,
  buildRunConfig,
  commitShift,
  createRun,
  DEFAULT_RULES,
  getShiftEconomy,
  getShiftRules,
  placePart,
  type BossModifierId,
  type RunConfig,
  type RunState,
} from '../src';
import { run as simulateRows } from './helpers';

/** 指定した夜のボスを差し替えた RunConfig */
function configWithBoss(id: BossModifierId, blockedCells: number[] = []): RunConfig {
  const config = buildRunConfig({ bossSeed: 1 });
  const bossPlan = config.bossPlan.map((e) => (e ? { id, blockedCells } : null));
  return { ...config, bossPlan };
}

const NIGHT = BALANCE.shifts.findIndex((s) => s.kind === 'boss');

describe('ボス計画', () => {
  it('夜シフトにだけ修正ルールがあり、同じシードなら同じ計画になる', () => {
    const a = buildRunConfig({ bossSeed: 42 });
    expect(a).toEqual(buildRunConfig({ bossSeed: 42 }));
    a.bossPlan.forEach((entry, i) => {
      expect(entry !== null).toBe(BALANCE.shifts[i]!.kind === 'boss');
    });
  });

  it('連続する夜が同じルールにならない', () => {
    for (let seed = 0; seed < 100; seed++) {
      const ids = buildRunConfig({ bossSeed: seed })
        .bossPlan.filter((e) => e)
        .map((e) => e!.id);
      for (let i = 1; i < ids.length; i++) expect(ids[i]).not.toBe(ids[i - 1]);
    }
  });

  it('いろいろなシードで5種すべてが選ばれうる', () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      buildRunConfig({ bossSeed: seed }).bossPlan.forEach((e) => e && seen.add(e.id));
    }
    expect(seen).toEqual(new Set(Object.keys(BOSS_MODIFIERS)));
  });

  it('通常シフトではルールは変わらない', () => {
    const config = configWithBoss('shortShift');
    expect(getShiftRules(config, 0)).toBe(config.rules);
    expect(getShiftEconomy(config, 0)).toBe(config.economy);
  });
});

describe('修正ルールの効果', () => {
  it('油切れ: コンベアの発動回数が減る', () => {
    const rules = getShiftRules(configWithBoss('lowOil'), NIGHT);
    expect(rules.maxActivations.conveyor).toBe(
      BALANCE.parts.conveyor.maxActivations! + BALANCE.boss.lowOilConveyorDelta,
    );
  });

  it('出荷検査強化: 出荷口の加算が半分（切り捨て）', () => {
    const rules = getShiftRules(configWithBoss('strictInspection'), NIGHT);
    expect(rules.dockDivisor).toBe(2);
    // ギア2つで 4 → 出荷 2、ギア1つで 2 → 1、ギアなしで 1 → 0
    expect(simulateRows(['S> G> G> D>'], 1, rules).scoreText).toBe('2');
    expect(simulateRows(['S> D>'], 1, rules).scoreText).toBe('0');
  });

  it('短縮営業: tick 上限が短くなる', () => {
    const rules = getShiftRules(configWithBoss('shortShift'), NIGHT);
    expect(rules.tickLimit).toBe(BALANCE.boss.shortShiftTickLimit);
  });

  it('部品不足: ショップの品数が減り、リロールできない', () => {
    const economy = getShiftEconomy(configWithBoss('partShortage'), NIGHT);
    expect(economy.offersPerShift).toBe(
      BALANCE.economy.offersPerShift + BALANCE.boss.partShortageOffersDelta,
    );
    expect(economy.reroll.enabled).toBe(false);
  });

  it('床の補修工事: 使用不可マスに入った信号は消え、そこには置けない', () => {
    const rules = { ...DEFAULT_RULES, blockedCells: [1] };
    const result = simulateRows(['S> D>'], 1, rules);
    expect(result.scoreText).toBe('0');
    expect(result.events.some((e) => e.type === 'vanish' && e.reason === 'blocked')).toBe(true);
  });

  it('床の補修工事: 夜の開始時に、使用不可マスのパーツは手持ちへ戻る', () => {
    const config = configWithBoss('repairWork', [0]);
    let run: RunState = { ...createRun(1), config };
    const placed = placePart(run, 'switch', 0, 0, 1);
    if (!placed.ok) throw new Error(placed.error);
    run = placed.state;
    // 夜の直前のシフトまで進めたことにし、ノルマ 0 の設定で確定して夜へ移る
    const nightRun: RunState = { ...run, shiftIndex: NIGHT - 1 };
    const easy = {
      ...config,
      shifts: config.shifts.map((s) => ({ ...s, quota: 0 })),
    };
    const result = commitAndGet({ ...nightRun, config: easy });
    expect(result.board.cells[0]).toBeNull();
    expect(result.inventory.switch).toBe(1);
    expect(placePart(result, 'switch', 0, 0, 1)).toEqual({ ok: false, error: 'cellBlocked' });
  });
});

/** シフトを確定して次の state を返す */
function commitAndGet(run: RunState): RunState {
  const committed = commitShift(run);
  if ('error' in committed) throw new Error(committed.error);
  return committed.state;
}
