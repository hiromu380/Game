/**
 * 再起動装置: 隣接4マスのパーツの発動回数をリセットし、信号を自身の向きへ送る。
 * 「ラン中1回だけ」は発動回数上限（balance.ts で既定1回）で表現している。
 */
import { getPart, neighbors4 } from '../../core/board';
import { dir4ToDir8 } from '../../core/direction';
import type { PartBehavior } from './types';

export const rebooterBehavior: PartBehavior = {
  react: ({ part, x, y, value, board }) => ({
    resets: neighbors4(board, x, y).filter(([nx, ny]) => getPart(board, nx, ny) !== null),
    emits: [{ dir: dir4ToDir8(part.dir), value }],
  }),
};
