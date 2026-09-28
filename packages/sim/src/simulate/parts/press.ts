/**
 * プレス機: 値に（pressBase + 隣接4マスのパーツ数 × pressPerNeighbor）を掛けて自身の向きへ送る
 * 既定値では「隣接パーツ数 + 1」倍
 */
import { getPart, neighbors4 } from '../../core/board';
import { dir4ToDir8 } from '../../core/direction';
import { scoreMul } from '../../core/score';
import type { PartBehavior } from './types';

export const pressBehavior: PartBehavior = {
  react: ({ part, x, y, value, board, rules }) => {
    const neighborCount = neighbors4(board, x, y).filter(
      ([nx, ny]) => getPart(board, nx, ny) !== null,
    ).length;
    const multiplier = rules.pressBase + neighborCount * rules.pressPerNeighbor;
    return { emits: [{ dir: dir4ToDir8(part.dir), value: scoreMul(value, multiplier) }] };
  },
};
