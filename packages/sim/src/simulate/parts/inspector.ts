/**
 * 検品台（配置系）: 隣接4マスに出荷口があれば inspectorMultiplier 倍、なければそのまま送る
 *
 * 出荷口の手前に置いて「最後の一押し」にする。
 */
import { getPart, neighbors4 } from '../../core/board';
import { dir4ToDir8 } from '../../core/direction';
import { scoreMul } from '../../core/score';
import type { Board, RuleSet } from '../../types';
import type { PartBehavior } from './types';

/** (x,y) に置いた検品台の倍率（クライアントの倍率バッジでも使う） */
export function getInspectorMultiplier(board: Board, x: number, y: number, rules: RuleSet): number {
  const nearDock = neighbors4(board, x, y).some(
    ([nx, ny]) => getPart(board, nx, ny)?.id === 'dock',
  );
  return nearDock ? rules.params.inspectorMultiplier : 1;
}

export const inspectorBehavior: PartBehavior = {
  react: ({ part, x, y, value, board, rules }) => ({
    emits: [
      {
        dir: dir4ToDir8(part.dir),
        value: scoreMul(value, getInspectorMultiplier(board, x, y, rules)),
      },
    ],
  }),
};
