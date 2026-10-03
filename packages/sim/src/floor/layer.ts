/**
 * 床の操作（純粋関数。元の配列は書き換えない）
 */
import { FLOOR_BEHAVIORS } from './tiles';
import type { FloorCell, FloorLayer } from './types';

/** 床のない床（長さ cellCount） */
export function emptyFloor(cellCount: number): FloorLayer {
  return new Array<FloorCell | null>(cellCount).fill(null);
}

/** index のマスの床（範囲外・未指定は null） */
export function getFloorCell(floor: FloorLayer | undefined, index: number): FloorCell | null {
  return floor?.[index] ?? null;
}

/** 使用不可のマスか（パーツを置けず、信号は消滅する） */
export function isBlockedCell(floor: FloorLayer | undefined, index: number): boolean {
  const cell = getFloorCell(floor, index);
  return !!cell && !!FLOOR_BEHAVIORS[cell.tile].blocked;
}

/** index のマスに床を置いた新しい床 */
export function setFloorCell(floor: FloorLayer, index: number, cell: FloorCell | null): FloorLayer {
  const next = [...floor];
  next[index] = cell;
  return next;
}
