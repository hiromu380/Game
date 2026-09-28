/**
 * マスごとの発動回数の上限を求める
 *
 * 基本はルールのパーツ別上限。常時効果を持つパーツ（潤滑油タンクなど）があれば、
 * シミュレーション開始時に一度だけ評価して上限を増減する。null は無制限のまま。
 */
import { getPart } from '../core/board';
import type { Board, RuleSet } from '../types';
import { PART_BEHAVIORS } from './parts';

export function computeActivationLimits(board: Board, rules: RuleSet): (number | null)[] {
  const limits = board.cells.map((part) => (part ? rules.maxActivations[part.id] : 0));

  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const part = getPart(board, x, y);
      const passive = part ? PART_BEHAVIORS[part.id].passive : undefined;
      if (!part || !passive) continue;

      for (const bonus of passive({ part, x, y, board, rules }).activationBonus ?? []) {
        const index = bonus.y * board.width + bonus.x;
        const current = limits[index];
        if (current === null || current === undefined) continue;
        limits[index] = Math.max(0, current + bonus.delta);
      }
    }
  }
  return limits;
}
