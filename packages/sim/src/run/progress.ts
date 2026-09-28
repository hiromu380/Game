/**
 * ラン全体の集計（結果画面・メタ進行用）
 */
import { SCORE_ZERO, scoreAdd, scoreFromString, type Score } from '../core/score';
import type { RunState } from './types';

/** ラン全体の最大連鎖数 */
export function getBestChain(state: RunState): number {
  return state.history.reduce((max, r) => Math.max(max, r.chainCount), 0);
}

/** ラン全体の出荷量合計 */
export function getTotalShipped(state: RunState): Score {
  return state.history.reduce((sum, r) => scoreAdd(sum, scoreFromString(r.score)), SCORE_ZERO);
}
