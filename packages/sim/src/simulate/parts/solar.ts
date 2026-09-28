/**
 * ソーラーパネル（配置系）: 値に（周囲8マスの空きマス数 × solarPerEmpty）を足して送る
 *
 * 掛け算ではなく足し算なので、値が小さい序盤ほど効く。密集させたいプレス機とは逆の性質。
 * 盤面外のマスは空きマスとして数えない。
 */
import { getPart, isInside } from '../../core/board';
import { ALL_DIR8, dir4ToDir8, dir8Delta } from '../../core/direction';
import { scoreAdd, scoreOf } from '../../core/score';
import type { Board, RuleSet } from '../../types';
import type { PartBehavior } from './types';

/** (x,y) に置いたソーラーパネルが足す値（クライアントのバッジでも使う） */
export function getSolarBonus(board: Board, x: number, y: number, rules: RuleSet): number {
  let empty = 0;
  for (const dir of ALL_DIR8) {
    const [dx, dy] = dir8Delta(dir);
    if (isInside(board, x + dx, y + dy) && getPart(board, x + dx, y + dy) === null) empty++;
  }
  return empty * rules.params.solarPerEmpty;
}

export const solarBehavior: PartBehavior = {
  react: ({ part, x, y, value, board, rules }) => ({
    emits: [
      {
        dir: dir4ToDir8(part.dir),
        value: scoreAdd(value, scoreOf(getSolarBonus(board, x, y, rules))),
      },
    ],
  }),
};
