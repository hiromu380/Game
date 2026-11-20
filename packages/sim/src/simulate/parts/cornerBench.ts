/**
 * 隅の作業台（配置系）: 盤面の端に置くと cornerBenchEdge 倍、角なら cornerBenchCorner 倍、それ以外はそのまま送る
 *
 * 盤面の外周という、ふだん使いにくい場所に価値を作る。
 */
import { dir4ToDir8 } from '../../core/direction';
import { scoreMul } from '../../core/score';
import type { Board, RuleSet } from '../../types';
import type { PartBehavior } from './types';

/** (x,y) に置いた隅の作業台の倍率（クライアントの倍率バッジでも使う） */
export function getCornerBenchMultiplier(
  board: Board,
  x: number,
  y: number,
  rules: RuleSet,
): number {
  const edgeX = x === 0 || x === board.width - 1;
  const edgeY = y === 0 || y === board.height - 1;
  if (edgeX && edgeY) return rules.params.cornerBenchCorner;
  if (edgeX || edgeY) return rules.params.cornerBenchEdge;
  return 1;
}

export const cornerBenchBehavior: PartBehavior = {
  react: ({ part, x, y, value, board, rules }) => ({
    emits: [
      {
        dir: dir4ToDir8(part.dir),
        value: scoreMul(value, getCornerBenchMultiplier(board, x, y, rules)),
      },
    ],
  }),
};
