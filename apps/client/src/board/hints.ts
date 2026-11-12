/**
 * 配置の手がかり: 選んだパーツを「置くと効果がいちばん大きい空きマス」を求める（描画に依存しない）
 *
 * 効果量の計算は sim の getPartBadge に任せる（画面側で式を持たない）。
 * 置き場所で効果が変わらないパーツ（コンベア・ギアなど）や、どこに置いても同じときは、手がかりを出さない。
 */
import {
  getPartBadge,
  isBlockedCell,
  type Board,
  type FloorLayer,
  type PartBadge,
  type PartId,
  type RuleSet,
} from '@chain-factory/sim';

export interface PlacementHints {
  /** 効果がいちばん大きい空きマス（マス番号） */
  cells: number[];
  /** そのときの効果量 */
  badge: PartBadge;
}

export function bestPlacementCells(
  board: Board,
  floor: FloorLayer,
  rules: RuleSet,
  partId: PartId,
): PlacementHints | null {
  let best: PartBadge | null = null;
  let lowest = Infinity;
  let cells: number[] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const index = y * board.width + x;
      if (board.cells[index] || isBlockedCell(floor, index)) continue;
      const badge = getPartBadge({ id: partId, dir: 0 }, board, x, y, rules);
      if (!badge) return null;
      lowest = Math.min(lowest, badge.value);
      if (!best || badge.value > best.value) {
        best = badge;
        cells = [index];
      } else if (badge.value === best.value) {
        cells.push(index);
      }
    }
  }
  // どこに置いても同じなら、手がかりにならない
  if (!best || best.value === lowest) return null;
  return { cells, badge: best };
}
