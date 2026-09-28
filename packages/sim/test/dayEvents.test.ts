import { describe, expect, it } from 'vitest';
import {
  activeEvent,
  applyOp,
  BALANCE,
  commitShift,
  createRun,
  getCurrentEconomy,
  getCurrentShift,
  getRefund,
  isEventPending,
  placePart,
  replayOps,
  type RunState,
} from '../src';
import { easyShifts, withBalance } from './testBalance';

// ノルマ 1・ボスなしの6シフト（2日分）
const balance = withBalance({ shifts: easyShifts(6, 99) });

/** スイッチ → 出荷口 を置いて本番を n 回（ノルマ 1 なので必ずクリア） */
function advance(run: RunState, times: number): RunState {
  let state = run;
  for (let i = 0; i < times; i++) {
    if (!state.board.cells.some(Boolean)) {
      const a = placePart(state, 'switch', 0, 0, 1);
      if (!a.ok) throw new Error(a.error);
      const b = placePart(a.state, 'dock', 1, 0, 1);
      if (!b.ok) throw new Error(b.error);
      state = b.state;
    }
    const result = commitShift(state);
    if ('error' in result) throw new Error(result.error);
    state = result.state;
  }
  return state;
}

/** 2日目の朝（イベントを選ぶ前）まで進めたラン */
const secondMorning = (seed = 1) => advance(createRun(seed, { balance }), 3);

describe('日ごとのイベント', () => {
  it('1日目はイベントなし。2日目の朝に候補が並び、選ぶまで組み立て・本番はできない', () => {
    const first = createRun(1, { balance });
    expect(first.dayEvent ?? null).toBeNull();
    const run = secondMorning();
    expect(run.dayEvent?.choices).toHaveLength(BALANCE.dayEvents.choices);
    expect(new Set(run.dayEvent!.choices).size).toBe(BALANCE.dayEvents.choices);
    expect(isEventPending(run)).toBe(true);
    expect(applyOp(run, { op: 'reroll' })).toEqual({ ok: false, error: 'eventNotChosen' });
    expect(commitShift(run)).toEqual({ error: 'eventNotChosen' });
  });

  it('候補は同じランなら毎回同じ（決定論）', () => {
    expect(secondMorning(7).dayEvent).toEqual(secondMorning(7).dayEvent);
  });

  it('選ぶと効果が出て、操作ログに残り、再生すると同じ状態になる', () => {
    const run = secondMorning();
    const chosen = applyOp(run, { op: 'chooseEvent', index: 0 });
    expect(chosen.ok).toBe(true);
    if (!chosen.ok) return;
    expect(isEventPending(chosen.state)).toBe(false);
    expect(activeEvent(chosen.state)).toBe(run.dayEvent!.choices[0]);
    expect(replayOps(run, [{ op: 'chooseEvent', index: 0 }])).toEqual({
      ok: true,
      state: chosen.state,
    });
    expect(applyOp(chosen.state, { op: 'chooseEvent', index: 1 })).toEqual({
      ok: false,
      error: 'noEventToChoose',
    });
  });

  /** 指定したイベントだけを候補にしたラン（2日目の朝・選択済み） */
  function withEvent(id: NonNullable<RunState['dayEvent']>['choices'][number]): RunState {
    const run = secondMorning();
    const forced = { ...run, dayEvent: { ...run.dayEvent!, choices: [id] } };
    const result = applyOp(forced, { op: 'chooseEvent', index: 0 });
    if (!result.ok) throw new Error(result.error);
    return result.state;
  }

  it('差し入れ: 予算が増える', () => {
    const before = secondMorning().budget;
    expect(withEvent('supplies').budget).toBe(before + BALANCE.dayEvents.suppliesBudget);
  });

  it('試供品: アンコモン以上のパーツが手持ちに増える', () => {
    const run = withEvent('sample');
    const part = run.dayEvent!.samplePart!;
    expect(BALANCE.dayEvents.sampleRarities).toContain(BALANCE.parts[part].rarity);
    expect(run.inventory[part] ?? 0).toBeGreaterThan(secondMorning().inventory[part] ?? 0);
  });

  it('特売日: 並んでいる商品とその日の価格が下がる（最低 1）', () => {
    const before = secondMorning();
    const run = withEvent('sale');
    run.shop.forEach((offer, i) => {
      expect(offer.price).toBe(Math.max(1, before.shop[i]!.price - BALANCE.dayEvents.saleDiscount));
    });
    expect(getCurrentEconomy(run).prices.gear).toBe(
      Math.max(1, BALANCE.parts.gear.price - BALANCE.dayEvents.saleDiscount),
    );
  });

  it('在庫整理: 売却の返金率が上がる', () => {
    expect(getRefund(withEvent('clearance'), 'gear')).toBe(
      Math.floor((BALANCE.parts.gear.price * BALANCE.dayEvents.clearanceRefundPercent) / 100),
    );
  });

  it('残業手当・腕まくり: 報酬とその日の朝のノルマが変わり、翌日には戻る', () => {
    const base = getCurrentShift(secondMorning());
    expect(getCurrentShift(withEvent('overtimePay')).clearReward).toBe(
      Math.floor((base.clearReward * BALANCE.dayEvents.overtimePayPercent) / 100),
    );
    const sleeves = withEvent('rollUpSleeves');
    expect(getCurrentShift(sleeves).quota).toBe(
      Math.max(1, Math.floor((base.quota * BALANCE.dayEvents.rollUpSleevesQuotaPercent) / 100)),
    );
    // 昼には朝のノルマ軽減は効かない
    const noon = advance(sleeves, 1);
    expect(getCurrentShift(noon).quota).toBe(noon.config.shifts[noon.shiftIndex]!.quota);
  });

  it('導入前に始めたラン（設定に項目がない）はイベントが起きない', () => {
    const run = createRun(1, { balance });
    const old = { ...run, config: { ...run.config, dayEvents: undefined } };
    expect(isEventPending(advance(old, 3))).toBe(false);
  });
});
