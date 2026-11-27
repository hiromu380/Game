/**
 * 磁石（配置系）: 値に（同じ行・同じ列にある出荷口の数 × magnetPerDock ＋ 1）を掛けて送る
 *
 * 出荷口を十字に並べた中心ほど強い。隣接している必要はない。
 */
import { getPart } from '../../core/board';
import { dir4ToDir8 } from '../../core/direction';
import { scoreMul } from '../../core/score';
import type { Board, RuleSet } from '../../types';
import type { PartBehavior } from './types';

/** (x,y) に置いた磁石の倍率（クライアントの倍率バッジでも使う） */
export function getMagnetMultiplier(board: Board, x: number, y: number, rules: RuleSet): number {
  let docks = 0;
  for (let i = 0; i < board.width; i++) if (i !== x && getPart(board, i, y)?.id === 'dock') docks++;
  for (let j = 0; j < board.height; j++)
    if (j !== y && getPart(board, x, j)?.id === 'dock') docks++;
  return 1 + docks * rules.params.magnetPerDock;
}

export const magnetBehavior: PartBehavior = {
  react: ({ part, x, y, value, board, rules }) => ({
    emits: [
      {
        dir: dir4ToDir8(part.dir),
        value: scoreMul(value, getMagnetMultiplier(board, x, y, rules)),
      },
    ],
  }),
};
