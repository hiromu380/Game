/**
 * ランの中の床: そのシフトで simulate に渡す床・配置できないマスの判定・床を湧かせる抽選
 *
 * そのシフトの床 = その日のステージ ＋ ボス・特殊ルールの使用不可（config/bossModifiers.ts の getShiftFloor）
 *                ＋ 今日の出来事の床（その日のあいだ） ＋ シフト開始時のボーナス床（そのシフトのあいだ）
 */
import { getShiftFloor } from '../config/bossModifiers';
import { createPrng } from '../core/prng';
import { cellPermutation, pickTile, pickWeighted } from '../floor/draw';
import { isBlockedCell, setFloorCell } from '../floor/layer';
import type { FloorLayer, FloorTileId } from '../floor/types';
import { bonusFloorSeed, dayEventSeed } from './seeds';
import type { BonusFloorState, RunState } from './types';

const dayOf = (state: RunState, shiftIndex: number) =>
  Math.floor(shiftIndex / state.config.shiftsPerDay);

/** そのシフトの床 */
export function getCurrentFloor(state: RunState, shiftIndex = state.shiftIndex): FloorLayer {
  let floor = getShiftFloor(state.config, shiftIndex);
  const event = state.dayEvent;
  if (event?.floorChanges && event.day === dayOf(state, shiftIndex)) {
    for (const change of event.floorChanges) {
      const current = floor[change.index] ?? null;
      if (change.tile === null) {
        // 使用不可の解消はステージの使用不可だけ（ボスの工事はその夜に効く）
        if (current?.source === 'stage' && isBlockedCell(floor, change.index)) {
          floor = setFloorCell(floor, change.index, null);
        }
      } else if (current === null) {
        floor = setFloorCell(floor, change.index, { tile: change.tile, source: 'event' });
      }
    }
  }
  if (state.bonusFloor?.shiftIndex === shiftIndex) {
    for (const cell of state.bonusFloor.cells) {
      if (floor[cell.index] === null) {
        floor = setFloorCell(floor, cell.index, { tile: cell.tile, source: 'bonus' });
      }
    }
  }
  return floor;
}

/** そのシフトで、パーツを置けないマスか */
export function isCellBlocked(state: RunState, index: number, shiftIndex = state.shiftIndex) {
  return isBlockedCell(getCurrentFloor(state, shiftIndex), index);
}

/** その日のうちに（どこかのシフトで）床があるマス。床の出来事・ボーナス床はここを避ける */
function occupiedToday(state: RunState, shiftIndex: number): Set<number> {
  const perDay = state.config.shiftsPerDay;
  const start = dayOf(state, shiftIndex) * perDay;
  const cells = new Set<number>();
  for (let i = start; i < start + perDay && i < state.config.shifts.length; i++) {
    getShiftFloor(state.config, i).forEach((c, index) => c && cells.add(index));
  }
  return cells;
}

/**
 * シフト開始時のボーナス床を抽選する。
 * 置けるマス = そのシフトの床がない・パーツがない・その日の夜の工事で使えなくならないマス
 */
export function drawBonusFloor(state: RunState, shiftIndex: number): BonusFloorState | null {
  const params = state.config.bonusFloors;
  if (!params || shiftIndex < params.fromShift) return null;
  const rng = createPrng(bonusFloorSeed(state.seed, shiftIndex));
  const count =
    pickWeighted(
      rng,
      params.countWeights.map((weight, n) => ({ value: n, weight })),
    ) ?? 0;
  const floor = getCurrentFloor({ ...state, bonusFloor: null }, shiftIndex);
  const avoid = occupiedToday(state, shiftIndex);
  const cells: BonusFloorState['cells'] = [];
  for (const index of cellPermutation(rng, state.board.cells.length)) {
    if (cells.length >= count) break;
    if (floor[index] !== null || avoid.has(index) || state.board.cells[index]) continue;
    const tile = pickTile(rng, params.tileWeights);
    if (tile) cells.push({ index, tile });
  }
  return cells.length > 0 ? { shiftIndex, cells } : null;
}

/** 盤面の中央に近い順のマス（同じ距離ならマス番号の小さい順） */
function cellsByCenter(width: number, height: number): number[] {
  const dist = (i: number) =>
    Math.abs(2 * (i % width) - (width - 1)) + Math.abs(2 * Math.floor(i / width) - (height - 1));
  return Array.from({ length: width * height }, (_, i) => i).sort(
    (a, b) => dist(a) - dist(b) || a - b,
  );
}

/**
 * 床の出来事で変わるマスを決める（選んだ瞬間に確定する。その日のあいだ有効）
 * - floorCenter: 中央に近い、床のないマスに1枚
 * - floorRepair: ステージの使用不可を1つ解消（並び順の先頭）
 * - floorAdds: 床のないマスに加算床を n 枚（並び順の先頭から）
 * どれも、その日のうちにボーナス床・工事・ステージの床があるマスは避ける
 */
export function drawFloorEvent(
  state: RunState,
  day: number,
  id: 'floorCenter' | 'floorRepair' | 'floorAdds',
): { index: number; tile: FloorTileId | null }[] {
  const events = state.config.dayEvents;
  if (!events) return [];
  const shiftIndex = day * state.config.shiftsPerDay;
  const floor = getCurrentFloor(state, shiftIndex);
  const avoid = occupiedToday(state, shiftIndex);
  if (state.bonusFloor) for (const c of state.bonusFloor.cells) avoid.add(c.index);
  const free = (i: number) => floor[i] === null && !avoid.has(i);
  const order = cellPermutation(
    createPrng(dayEventSeed(state.seed, day, 2)),
    state.board.cells.length,
  );

  switch (id) {
    case 'floorCenter': {
      const index = cellsByCenter(state.board.width, state.board.height).find(free);
      return index === undefined ? [] : [{ index, tile: events.floorCenterTile }];
    }
    case 'floorRepair': {
      const index = order.find((i) => floor[i]?.source === 'stage' && isBlockedCell(floor, i));
      return index === undefined ? [] : [{ index, tile: null }];
    }
    case 'floorAdds':
      return order
        .filter(free)
        .slice(0, events.floorAddsCount)
        .map((index) => ({ index, tile: 'add' as const }));
  }
}

/** その日に床の出来事が意味を持つか（解消できる使用不可がない日は「使用不可の解消」を候補にしない） */
export function canOfferFloorEvent(state: RunState, day: number, id: string): boolean {
  if (id !== 'floorRepair') return true;
  const floor = state.config.stages?.days[day];
  return !!floor && floor.some((_, i) => floor[i]?.source === 'stage' && isBlockedCell(floor, i));
}
