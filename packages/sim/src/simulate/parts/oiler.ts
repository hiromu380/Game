/**
 * 潤滑油タンク（再発動系）: 信号には反応しない。隣接4マスのパーツの発動回数上限を増やす（常時）
 *
 * ギアやプレス機の隣に置くと、同じパーツを2回通す配線が組めるようになる。
 * 発動回数が無制限のパーツ（出荷口）には効果がない。
 */
import { getPart, neighbors4 } from '../../core/board';
import type { PartBehavior } from './types';

export const oilerBehavior: PartBehavior = {
  react: null,
  passive: ({ x, y, board, rules }) => ({
    activationBonus: neighbors4(board, x, y)
      .filter(([nx, ny]) => getPart(board, nx, ny) !== null)
      .map(([nx, ny]) => ({ x: nx, y: ny, delta: rules.params.oilerBonus })),
  }),
};
