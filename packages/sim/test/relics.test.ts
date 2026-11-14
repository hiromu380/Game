/**
 * レリック: 夜をクリアすると3つの候補から1つ選び、ランの終わりまで効く
 */
import { describe, expect, it } from 'vitest';
import {
  applyOp,
  applyRelicEconomy,
  applyRelicRules,
  BALANCE,
  commitShift,
  createRun,
  DEFAULT_RULES,
  drawRelicChoice,
  getCurrentEconomy,
  getCurrentRules,
  getCurrentShift,
  isRelicPending,
  placePart,
  RELIC_IDS,
  relicWeights,
  replayOps,
  simulate,
  type RelicId,
  type RunState,
} from '../src';
import { board } from './helpers';
import { easyShifts, withBalance } from './testBalance';

const P = BALANCE.relics.params;

/** ノルマ 1 のシフト表で、スイッチ → 出荷口を置いて本番を確定する */
function clearShift(run: RunState): RunState {
  let state = run;
  if (state.dayEvent && state.dayEvent.chosen === null) {
    const r = applyOp(state, { op: 'chooseEvent', index: 0 });
    if (r.ok) state = r.state;
  }
  if (!state.board.cells.some((c) => c?.id === 'switch')) {
    const a = placePart(state, 'switch', 0, 0, 1);
    if (a.ok) state = a.state;
    const b = placePart(state, 'dock', 1, 0, 1);
    if (b.ok) state = b.state;
  }
  const committed = commitShift(state);
  if ('error' in committed) throw new Error(committed.error);
  return committed.state;
}

function runToFirstNight(seed = 3): RunState {
  // ボスなし（出荷量が 0 にならないように）。3シフト目を夜（ボス扱い）にするため bossEvery=3 だがボス計画は空にする
  const base = createRun(seed, { balance: withBalance({ shifts: easyShifts(9) }) });
  let run: RunState = {
    ...base,
    config: { ...base.config, bossPlan: base.config.bossPlan.map(() => null) },
  };
  run = {
    ...run,
    board: { ...run.board, cells: run.board.cells.map(() => null) },
    inventory: { switch: 1, dock: 1 },
  };
  for (let i = 0; i < 3; i++) run = clearShift(run);
  // 2日目の朝は今日の出来事も選ぶ（レリックとは別。どちらを先に選んでもよい）
  const chosen = applyOp(run, { op: 'chooseEvent', index: 0 });
  return chosen.ok ? chosen.state : run;
}

describe('レリックの候補', () => {
  it('夜のシフトをクリアした次のシフトで、持っていない3つの候補が出る。選ぶまで本番・ほかの操作はできない', () => {
    const run = runToFirstNight();
    expect(run.shiftIndex).toBe(3);
    expect(isRelicPending(run)).toBe(true);
    const choices = run.relicChoice!.choices;
    expect(choices).toHaveLength(BALANCE.relics.choices);
    expect(new Set(choices).size).toBe(choices.length);
    expect(commitShift(run)).toEqual({ error: 'relicNotChosen' });
    expect(applyOp(run, { op: 'reroll' })).toEqual({ ok: false, error: 'relicNotChosen' });

    const picked = applyOp(run, { op: 'pickRelic', index: 1 });
    if (!picked.ok) throw new Error(picked.error);
    expect(picked.state.relics).toEqual([choices[1]]);
    expect(isRelicPending(picked.state)).toBe(false);
    expect(applyOp(picked.state, { op: 'pickRelic', index: 0 })).toEqual({
      ok: false,
      error: 'noRelicToPick',
    });
  });

  it('朝・昼のシフトの後には出ない', () => {
    const base = createRun(3, { balance: withBalance({ shifts: easyShifts(9) }) });
    expect(base.relicChoice ?? null).toBeNull();
  });

  it('候補は同じシードなら同じ（決定論）。持っているレリックは出ない', () => {
    const run = runToFirstNight(5);
    expect(drawRelicChoice(run, 0)).toEqual(drawRelicChoice(run, 0));
    const owned: RunState = { ...run, relics: [...RELIC_IDS.slice(0, RELIC_IDS.length - 2)] };
    const left = drawRelicChoice(owned, 0);
    expect(left.every((id) => !owned.relics!.includes(id))).toBe(true);
    expect(left).toHaveLength(2);
  });

  it('出やすさはレア度と夜で決まる: 1日目の夜にレジェンドは出ず、夜が進むほど上位が出やすい', () => {
    const run = runToFirstNight(5);
    const relics = run.config.relics!;
    const share = (day: number, rarity: string) => {
      const w = relicWeights(relics, day);
      const total = w.reduce((n, p) => n + p.weight, 0);
      return (
        w.filter((p) => relics.rarity![p.id] === rarity).reduce((n, p) => n + p.weight, 0) / total
      );
    };
    expect(share(0, 'legendary')).toBe(0);
    expect(share(1, 'legendary')).toBeGreaterThan(0);
    expect(share(5, 'rare')).toBeGreaterThan(share(0, 'rare'));
    expect(share(5, 'common')).toBeLessThan(share(0, 'common'));
    // 延長戦の夜（表より先の日）は最後の値を使う
    expect(relicWeights(relics, 9)).toEqual(relicWeights(relics, 2));
    for (let seed = 1; seed <= 30; seed++) {
      const r = runToFirstNight(seed);
      expect(drawRelicChoice(r, 0).every((id) => relics.rarity![id] !== 'legendary')).toBe(true);
    }
  });

  it('レア度を導入する前のラン（RunConfig にレリックごとの重みだけがある）は、その重みで出す', () => {
    const run = runToFirstNight(5);
    const only = RELIC_IDS[0]!;
    const weights = Object.fromEntries(RELIC_IDS.map((id) => [id, id === only ? 1 : 0])) as Record<
      RelicId,
      number
    >;
    const legacy: RunState = {
      ...run,
      config: { ...run.config, relics: { choices: 3, weights, params: run.config.relics!.params } },
    };
    expect(drawRelicChoice(legacy, 0)).toEqual([only]);
  });

  it('操作ログで選択を再生できる（サーバーの検証）', () => {
    const run = runToFirstNight(7);
    const replayed = replayOps(run, [{ op: 'pickRelic', index: 2 }, { op: 'reroll' }]);
    expect(replayed.ok && replayed.state.relics).toEqual([run.relicChoice!.choices[2]]);
  });

  it('導入前のラン（設定に relics がない）では候補が出ない', () => {
    const base = createRun(3, { balance: withBalance({ shifts: easyShifts(9) }) });
    let run: RunState = {
      ...base,
      config: { ...base.config, relics: undefined, bossPlan: base.config.bossPlan.map(() => null) },
    };
    run = {
      ...run,
      board: { ...run.board, cells: run.board.cells.map(() => null) },
      inventory: { switch: 1, dock: 1 },
    };
    for (let i = 0; i < 3; i++) run = clearShift(run);
    expect(isRelicPending(run)).toBe(false);
  });
});

describe('レリックの効果', () => {
  const rules = (ids: RelicId[]) => applyRelicRules(DEFAULT_RULES, ids, P);
  const score = (rows: string[], ids: RelicId[]) =>
    simulate({ board: board(rows), seed: 1, rules: rules(ids) }).score;

  it('予備のスイッチ: 信号の初期値が増える', () => {
    expect(score(['S> D>'], ['spareSwitch'])).toBe(BigInt(1 + P.spareSwitchAdd));
  });

  it('ギア職人の手袋・二重チェック・巻き直したコイル: 倍率が増える', () => {
    expect(score(['S> G> D>'], ['gearGloves'])).toBe(BigInt(2 + P.gearAdd));
    expect(rules(['doubleCheck']).params.inspectorMultiplier).toBe(
      DEFAULT_RULES.params.inspectorMultiplier + P.inspectorAdd,
    );
    expect(rules(['rewoundCoil']).params.coilPerNeighbor).toBe(
      DEFAULT_RULES.params.coilPerNeighbor + P.coilAdd,
    );
  });

  it('連鎖の鼓動・金箔・ポンコツの勘・磨いた床・貯金癖', () => {
    expect(rules(['chainPulse']).params.chainMeterStep).toBe(
      DEFAULT_RULES.params.chainMeterStep - P.chainMeterStepDelta,
    );
    expect(rules(['goldLeaf']).goldenMultiplier).toBe(
      DEFAULT_RULES.goldenMultiplier! + P.goldenAdd,
    );
    const junk = rules(['junkbotHunch']).params;
    expect(junk.junkbotMinSteps / junk.junkbotStepDivisor).toBeGreaterThanOrEqual(1);
    expect(rules(['polishedFloor']).floorParams.doubleMultiplier).toBe(P.polishedDoubleMultiplier);
    expect(rules(['piggyHabit']).params.piggyBankIncome).toBe(
      DEFAULT_RULES.params.piggyBankIncome + P.piggyAdd,
    );
  });

  it('予備の油: 発動回数に上限のあるパーツだけ +1（上限なし・反応しないパーツはそのまま）。余熱: ドラム缶だけ +1', () => {
    const r = rules(['spareOil', 'afterglow']);
    expect(r.maxActivations.gear).toBe(DEFAULT_RULES.maxActivations.gear! + P.spareOilAdd);
    expect(r.maxActivations.barrel).toBe(
      DEFAULT_RULES.maxActivations.barrel! + P.spareOilAdd + P.afterglowAdd,
    );
    expect(r.maxActivations.dock).toBeNull();
    expect(r.maxActivations.oiler).toBe(0);
  });

  it('割引クーポン・目利き: 価格が下がり（最低1）、ショップの枠が増える', () => {
    const run = createRun(1);
    const e = applyRelicEconomy(run.config.economy, ['coupon', 'connoisseur'], P);
    expect(e.prices.gear).toBe(Math.max(1, run.config.economy.prices.gear - P.couponDiscount));
    expect(e.prices.conveyor).toBe(1);
    expect(e.prices.switch).toBe(0);
    expect(e.offersPerShift).toBe(run.config.economy.offersPerShift + P.connoisseurOffers);
  });

  it('レリックを持つと、現在のルール・経済・夜のシフトの報酬に重なる。選んだ後の品揃えは新しい枠数で並ぶ', () => {
    const run = runToFirstNight(9);
    const withRelics: RunState = { ...run, relics: ['gearGloves', 'connoisseur', 'nightPay'] };
    expect(getCurrentRules(withRelics).params.gearMultiplier).toBe(2 + P.gearAdd);
    expect(getCurrentEconomy(withRelics).offersPerShift).toBe(
      run.config.economy.offersPerShift + P.connoisseurOffers,
    );
    const night: RunState = { ...withRelics, shiftIndex: 5 };
    expect(getCurrentShift(night).clearReward).toBe(
      run.config.shifts[5]!.clearReward + P.nightPayReward,
    );
    expect(getCurrentShift({ ...withRelics, shiftIndex: 4 }).clearReward).toBe(
      run.config.shifts[4]!.clearReward,
    );

    const index = run.relicChoice!.choices.indexOf('connoisseur');
    if (index >= 0) {
      const picked = applyOp(run, { op: 'pickRelic', index });
      expect(picked.ok && picked.state.shop.length).toBe(run.shop.length + P.connoisseurOffers);
    }
  });
});
