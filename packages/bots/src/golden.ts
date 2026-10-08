/**
 * ボットの金色パーツの扱い（組み立てを終えた盤面で、見込みが増えるときだけ）
 *
 * 1. 手持ちの金色パーツ（前の日に合体したもの）を、空きマス × 4方向のうち見込みがいちばん増える所に置く
 * 2. 合体できるマスを1つずつ試し、見込みがいちばん増える合体をする（増えなくなるまでくり返す）
 *
 * 合体のために並べ方を変えることはしない（ボットが組んだ盤面にたまたま3つつながったときだけ合体する）。
 * そのため実際に遊ぶ人より金色パーツを使う回数は少ない（上限の目安ではなく、下限の目安）
 */
import {
  getPart,
  goldenCount,
  mergeCells,
  mergeGolden,
  PART_IDS,
  placePart,
  type Dir4,
  type RunState,
} from '@chain-factory/sim';
import { evaluate, type EvalMode } from './evaluate';

export interface GoldenLog {
  /** 合体した回数 */
  merged: number;
  /** 手持ちの金色パーツを置いた回数 */
  placed: number;
}

export function playGolden(
  state: RunState,
  samples: number,
  mode: EvalMode,
  log: GoldenLog,
): RunState {
  const score = (s: RunState) => evaluate(s, samples, mode).score;
  let current = state;
  let best = score(current);
  const { width, height } = current.board;

  // 1. 手持ちの金色パーツを置く
  for (const partId of PART_IDS) {
    while (goldenCount(current, partId) > 0) {
      let found: { state: RunState; score: bigint } | null = null;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (getPart(current.board, x, y)) continue;
          for (const dir of [0, 1, 2, 3] as Dir4[]) {
            const placed = placePart(current, partId, x, y, dir, true);
            if (!placed.ok) continue;
            const s = score(placed.state);
            if (s > (found?.score ?? best)) found = { state: placed.state, score: s };
          }
        }
      }
      if (!found) break;
      current = found.state;
      best = found.score;
      log.placed++;
    }
  }

  // 2. 合体する
  for (let guard = 0; guard < width * height; guard++) {
    let found: { state: RunState; score: bigint } | null = null;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!mergeCells(current, x, y)) continue;
        const merged = mergeGolden(current, x, y);
        if (!merged.ok) continue;
        const s = score(merged.state);
        if (s > (found?.score ?? best)) found = { state: merged.state, score: s };
      }
    }
    if (!found) break;
    current = found.state;
    best = found.score;
    log.merged++;
  }
  return current;
}
