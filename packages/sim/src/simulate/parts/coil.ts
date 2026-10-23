/**
 * 共鳴コイル（配置系）: 値に（coilBase ＋ 隣接4マスの共鳴コイル数 × coilPerNeighbor）を掛けて送る
 *
 * 1つでも効き（×2）、コイル同士を固めて置くほど強い。隣接枠を使うのでプレス機とは取り合いになる。
 */
import { getPart, neighbors4 } from '../../core/board';
import { dir4ToDir8 } from '../../core/direction';
import { scoreMul } from '../../core/score';
import type { Board, RuleSet } from '../../types';
import type { PartBehavior } from './types';

/** (x,y) に置いた共鳴コイルの倍率（クライアントの倍率バッジでも使う） */
export function getCoilMultiplier(board: Board, x: number, y: number, rules: RuleSet): number {
  const coils = neighbors4(board, x, y).filter(([nx, ny]) => getPart(board, nx, ny)?.id === 'coil');
  return rules.params.coilBase + coils.length * rules.params.coilPerNeighbor;
}

export const coilBehavior: PartBehavior = {
  react: ({ part, x, y, value, board, rules }) => ({
    emits: [
      { dir: dir4ToDir8(part.dir), value: scoreMul(value, getCoilMultiplier(board, x, y, rules)) },
    ],
  }),
};
