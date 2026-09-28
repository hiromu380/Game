/**
 * 盤面に表示する「効果量バッジ」（例: ギア ×2、プレス機 ×4、ソーラー +3）
 *
 * クライアントはこの関数の結果をそのまま表示する（計算式を画面側で再実装しないため）。
 * 置き場所だけで決まる効果のみを返す。実行中に変わる効果（連鎖メーターなど）は null。
 */
import type { Board, Part, RuleSet } from '../types';
import { getCoilMultiplier } from './parts/coil';
import { getInspectorMultiplier } from './parts/inspector';
import { getPressMultiplier } from './parts/press';
import { getSolarBonus } from './parts/solar';

export interface PartBadge {
  kind: 'mul' | 'add';
  value: number;
}

export function getPartBadge(
  part: Part,
  board: Board,
  x: number,
  y: number,
  rules: RuleSet,
): PartBadge | null {
  switch (part.id) {
    case 'gear':
      return { kind: 'mul', value: rules.params.gearMultiplier };
    case 'press':
      return { kind: 'mul', value: getPressMultiplier(board, x, y, rules) };
    case 'coil':
      return { kind: 'mul', value: getCoilMultiplier(board, x, y, rules) };
    case 'inspector':
      return { kind: 'mul', value: getInspectorMultiplier(board, x, y, rules) };
    case 'solar':
      return { kind: 'add', value: getSolarBonus(board, x, y, rules) };
    default:
      return null;
  }
}
