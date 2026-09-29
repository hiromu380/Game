/**
 * ランの中の床: そのシフトで simulate に渡す床と、配置できないマスの判定
 */
import { getShiftFloor } from '../config/bossModifiers';
import { isBlockedCell } from '../floor/layer';
import type { FloorLayer } from '../floor/types';
import type { RunState } from './types';

/** そのシフトの床（その日のステージ ＋ ボス・特殊ルールの使用不可） */
export function getCurrentFloor(state: RunState, shiftIndex = state.shiftIndex): FloorLayer {
  return getShiftFloor(state.config, shiftIndex);
}

/** そのシフトで、パーツを置けないマスか */
export function isCellBlocked(state: RunState, index: number, shiftIndex = state.shiftIndex) {
  return isBlockedCell(getCurrentFloor(state, shiftIndex), index);
}
