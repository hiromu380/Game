/**
 * 消耗品（手持ちのパーツとは別に持つ）: 今はランダム配置権だけ
 *
 * - 配置権は買った日の終わりまで有効（expiresDay）。日が変わると、使っていない配置権も、配置権で湧いた床も消える
 * - 使うと、その場で床の位置と種類が決まる（run/floor.ts の drawFloorPermit。本番スイッチの前に結果が見える）
 * - 使った配置権は取り消せない（返却・売却はできない）。置けるマスがなければ減らさない
 */
import type { ItemId } from '../balance';
import { drawFloorPermit } from './floor';
import type { HeldItem, RunActionResult, RunState } from './types';

/** 何日目（0 始まり）か */
const dayOf = (state: RunState, shiftIndex = state.shiftIndex) =>
  Math.floor(shiftIndex / state.config.shiftsPerDay);

/** 持っている数 */
export function countItems(state: RunState, id: ItemId): number {
  return (state.items ?? []).filter((item) => item.id === id).length;
}

/** 消耗品を1つ手持ちに加える（その日の終わりまで有効）。上限を超えるなら失敗 */
export function addItem(state: RunState, id: ItemId): RunActionResult {
  const max = state.config.floorPermit?.maxHeld ?? 0;
  if (countItems(state, id) >= max) return { ok: false, error: 'itemLimit' };
  const item: HeldItem = { id, expiresDay: dayOf(state) };
  return { ok: true, state: { ...state, items: [...(state.items ?? []), item] } };
}

/** ランダム配置権を1枚使う: 盤面のどこかに床が1枚湧く */
export function useFloorPermit(state: RunState): RunActionResult {
  if (state.phase !== 'building') return { ok: false, error: 'notBuilding' };
  const items = state.items ?? [];
  const at = items.findIndex((item) => item.id === 'floorPermit');
  if (at < 0) return { ok: false, error: 'noItem' };
  const drawn = drawFloorPermit(state);
  if (!drawn) return { ok: false, error: 'noCellForItem' };
  const day = dayOf(state);
  const previous = state.itemFloors?.day === day ? state.itemFloors.cells : [];
  return {
    ok: true,
    state: {
      ...state,
      items: items.filter((_, i) => i !== at),
      itemFloors: { day, cells: [...previous, drawn] },
    },
  };
}

/** 日が変わったとき: 期限が切れた消耗品と、前の日に配置権で湧いた床を消す */
export function expireItems(state: RunState, shiftIndex: number): RunState {
  const day = dayOf(state, shiftIndex);
  const items = (state.items ?? []).filter((item) => item.expiresDay >= day);
  const itemFloors = state.itemFloors?.day === day ? state.itemFloors : null;
  if (items.length === (state.items ?? []).length && itemFloors === (state.itemFloors ?? null)) {
    return state;
  }
  return { ...state, items, itemFloors };
}
