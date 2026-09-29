/**
 * 日ごとのイベント: 2日目以降の朝（1日の最初のシフト）に、候補から1つ選ぶ。効果はその日のうちだけ
 *
 * - 候補はランシードと日から決まる（同じランなら毎回同じ候補）
 * - 選ぶまでは組み立て・本番はできない（選んだ結果で価格などが変わるため）
 * - 選んだ瞬間に効く効果（予算・試供品・値引き中の商品の値下げ）と、その日のあいだ効く効果
 *   （値引き・返金率・報酬・朝のノルマ）がある。後者は getCurrentEconomy / getCurrentShift に重ねる
 */
import type { DayEventId, ShiftSpec } from '../balance';
import type { EconomyConfig } from '../config/runConfig';
import { createPrng } from '../core/prng';
import { canOfferFloorEvent, drawFloorEvent } from './floor';
import { addInventory } from './inventory';
import { dayEventSeed } from './seeds';
import type { DayEventState, RunActionResult, RunState } from './types';

/** 何日目（0 始まり）か */
const dayOf = (state: RunState, shiftIndex: number) =>
  Math.floor(shiftIndex / state.config.shiftsPerDay);

/** その日のイベントの候補を抽選する（イベントのない設定なら null） */
export function drawDayEvent(state: RunState, day: number): DayEventState | null {
  const events = state.config.dayEvents;
  if (!events) return null;
  // 試供品で出せるパーツがなければ、試供品は候補から外す
  // 解消できる使用不可がない日は「使用不可の解消」も外す
  const pool = events.candidates.filter(
    (id) => (id !== 'sample' || events.samplePool.length > 0) && canOfferFloorEvent(state, day, id),
  );
  const rng = createPrng(dayEventSeed(state.seed, day, 0));
  const choices: DayEventId[] = [];
  const rest = [...pool];
  while (choices.length < events.choices && rest.length > 0) {
    choices.push(rest.splice(rng.nextInt(rest.length), 1)[0]!);
  }
  return { day, choices, chosen: null, samplePart: null };
}

/** 今日のイベントをまだ選んでいないか（選ぶまで組み立て・本番はできない） */
export function isEventPending(state: RunState): boolean {
  return !!state.dayEvent && state.dayEvent.chosen === null;
}

/** そのシフトで効いているイベント（選んだ日のシフトだけ） */
export function activeEvent(state: RunState, shiftIndex = state.shiftIndex): DayEventId | null {
  const event = state.dayEvent;
  if (!event?.chosen || dayOf(state, shiftIndex) !== event.day) return null;
  return event.chosen;
}

/** 候補の index 番目のイベントを選ぶ */
export function chooseEvent(state: RunState, index: number): RunActionResult {
  const event = state.dayEvent;
  const events = state.config.dayEvents;
  if (state.phase !== 'building') return { ok: false, error: 'notBuilding' };
  if (!event || event.chosen !== null || !events) return { ok: false, error: 'noEventToChoose' };
  const chosen = event.choices[index];
  if (!chosen) return { ok: false, error: 'noEventToChoose' };

  let next: RunState = { ...state, dayEvent: { ...event, chosen } };
  switch (chosen) {
    case 'supplies':
      next = { ...next, budget: next.budget + events.suppliesBudget };
      break;
    case 'sample': {
      const rng = createPrng(dayEventSeed(state.seed, event.day, 1));
      const part = events.samplePool[rng.nextInt(events.samplePool.length)]!;
      next = {
        ...next,
        inventory: addInventory(next.inventory, part, 1),
        dayEvent: { ...event, chosen, samplePart: part },
      };
      break;
    }
    case 'floorCenter':
    case 'floorRepair':
    case 'floorAdds':
      // 床の出来事: 選んだ瞬間に位置を確定する（その日のあいだ getCurrentFloor で重ねる）
      next = {
        ...next,
        dayEvent: { ...event, chosen, floorChanges: drawFloorEvent(state, event.day, chosen) },
      };
      break;
    case 'sale':
      // 今並んでいる商品も値下げする（リロール後の商品は getCurrentEconomy の価格で並ぶ）
      next = {
        ...next,
        shop: next.shop.map((o) => ({ ...o, price: discounted(o.price, events.saleDiscount) })),
      };
      break;
    default:
      // その日のあいだ効く効果（getCurrentEconomy / getCurrentShift で重ねる）
      break;
  }
  return { ok: true, state: next };
}

const discounted = (price: number, discount: number) =>
  price > 0 ? Math.max(1, price - discount) : price;

/** イベントを経済設定に重ねる（特売日: 値引き、在庫整理: 返金率） */
export function applyEventEconomy(
  state: RunState,
  shiftIndex: number,
  economy: EconomyConfig,
): EconomyConfig {
  const events = state.config.dayEvents;
  const event = activeEvent(state, shiftIndex);
  if (!events || !event) return economy;
  if (event === 'sale') {
    const prices = { ...economy.prices };
    for (const id of Object.keys(prices) as (keyof typeof prices)[]) {
      prices[id] = discounted(prices[id], events.saleDiscount);
    }
    return { ...economy, prices };
  }
  if (event === 'clearance') return { ...economy, refundPercent: events.clearanceRefundPercent };
  return economy;
}

/** イベントをシフトの設定に重ねる（残業手当: 報酬、腕まくり: 朝のノルマ） */
export function applyEventShift(state: RunState, shiftIndex: number, spec: ShiftSpec): ShiftSpec {
  const events = state.config.dayEvents;
  const event = activeEvent(state, shiftIndex);
  if (!events || !event) return spec;
  if (event === 'overtimePay') {
    return {
      ...spec,
      clearReward: Math.floor((spec.clearReward * events.overtimePayPercent) / 100),
    };
  }
  if (event === 'rollUpSleeves' && shiftIndex % state.config.shiftsPerDay === 0) {
    return {
      ...spec,
      quota: Math.max(1, Math.floor((spec.quota * events.rollUpSleevesQuotaPercent) / 100)),
    };
  }
  return spec;
}
