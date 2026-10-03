/**
 * 床タイルの一覧（新しい床タイルは、ファイルを1つ足してここに登録する）
 */
import type { FloorBehavior, FloorTileId } from '../types';
import { addFloor } from './add';
import { blockedFloor } from './blocked';
import { doubleFloor } from './double';
import { tripleFloor } from './triple';

export const FLOOR_BEHAVIORS: Record<FloorTileId, FloorBehavior> = {
  double: doubleFloor,
  add: addFloor,
  triple: tripleFloor,
  blocked: blockedFloor,
};
