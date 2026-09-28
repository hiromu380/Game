/**
 * 再起動装置: 隣接4マスのパーツの発動回数をリセットし、信号を自身の向きへ送る。
 * 「1回のシミュレーション中1回だけ」は発動回数上限（balance.ts で既定1回）で表現している。
 *
 * 隣の再起動装置はリセットしない。リセットし合うと「1回だけ」が破れ、
 * 周りのパーツごと tick 上限まで無限に回り続けてしまうため（バランス検証で発見）。
 */
import { getPart, neighbors4 } from '../../core/board';
import { dir4ToDir8 } from '../../core/direction';
import type { PartBehavior } from './types';

export const rebooterBehavior: PartBehavior = {
  react: ({ part, x, y, value, board }) => ({
    resets: neighbors4(board, x, y).filter(([nx, ny]) => {
      const neighbor = getPart(board, nx, ny);
      return neighbor !== null && neighbor.id !== 'rebooter';
    }),
    emits: [{ dir: dir4ToDir8(part.dir), value }],
  }),
};
