/**
 * プレス機: 値に（pressBase + 隣接4マスのパーツ数 × pressPerNeighbor）を掛けて自身の向きへ送る
 * 既定値では「隣接パーツ数 + 1」倍
 */
import { getPart, neighbors4 } from '../../core/board';
import { dir4ToDir8 } from '../../core/direction';
import { scoreMul } from '../../core/score';
import type { Board, RuleSet } from '../../types';
import type { PartBehavior } from './types';

/**
 * (x,y) に置いたプレス機の倍率。
 * クライアントの倍率バッジ表示でも使う（表示側で計算式を再実装しないため）
 */
export function getPressMultiplier(board: Board, x: number, y: number, rules: RuleSet): number {
  const neighborCount = neighbors4(board, x, y).filter(
    ([nx, ny]) => getPart(board, nx, ny) !== null,
  ).length;
  return rules.pressBase + neighborCount * rules.pressPerNeighbor;
}

export const pressBehavior: PartBehavior = {
  react: ({ part, x, y, value, board, rules }) => ({
    emits: [
      {
        dir: dir4ToDir8(part.dir),
        value: scoreMul(value, getPressMultiplier(board, x, y, rules)),
      },
    ],
  }),
};
