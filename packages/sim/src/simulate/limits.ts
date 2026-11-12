/**
 * マスごとの発動回数の上限を求める
 *
 * 基本はルールのパーツ別上限。常時効果を持つパーツ（潤滑油タンクなど）があれば、
 * シミュレーション開始時に一度だけ評価して上限を増減する。null は無制限のまま。
 */
import type { Board, RuleSet } from '../types';
import { PART_BEHAVIORS } from './parts';

export function computeActivationLimits(board: Board, rules: RuleSet): (number | null)[] {
  const { cells, width } = board;
  const maxActivations = rules.maxActivations;
  const limits = new Array<number | null>(cells.length);
  /** 常時効果を持つパーツのマス（ほとんどの盤面では0〜数個。あるときだけ後で評価する） */
  let passiveCells: number[] | null = null;
  for (let index = 0; index < cells.length; index++) {
    const part = cells[index];
    if (!part) {
      limits[index] = 0;
      continue;
    }
    limits[index] = maxActivations[part.id];
    if (PART_BEHAVIORS[part.id].passive) (passiveCells ??= []).push(index);
  }
  if (!passiveCells) return limits;

  // 常時効果はマス番号の昇順（行優先）に評価する
  for (const cell of passiveCells) {
    const part = cells[cell]!;
    const x = cell % width;
    const y = (cell - x) / width;
    const effect = PART_BEHAVIORS[part.id].passive!({ part, x, y, board, rules });
    for (const bonus of effect.activationBonus ?? []) {
      const index = bonus.y * width + bonus.x;
      const current = limits[index];
      if (current === null || current === undefined) continue;
      limits[index] = Math.max(0, current + bonus.delta);
    }
  }
  return limits;
}
