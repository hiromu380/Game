/**
 * 貪欲ボット: 1手ずつ、評価がいちばん上がる手を選ぶ
 *
 * 各手（手持ちを置く／買って置く）を実際に simulate して評価し、最も良くなる手を打つ。
 * 良くなる手がなくなったら、予算に余裕があればリロールし、なければシフトを終える。
 * 「先を読まない」ので、すぐには効かない投資（出荷口を先に置く等）はしない。
 */
import { compareEvaluation, evaluate, type Evaluation } from '../evaluate';
import { applyMove, canReroll, listMoves, type Move } from '../moves';
import type { Bot } from './types';

/** リロールしても予算を残す額（よく使うパーツを1つ買える程度） */
const REROLL_RESERVE = 4;
/** 1シフトで打つ手の上限（無限ループ防止） */
const MAX_STEPS = 40;

export const greedyBot: Bot = {
  name: 'greedy',
  playShift(initial, { samples, evalMode, maxRerolls }) {
    let state = initial;
    const moves: Move[] = [];
    let rerolls = 0;

    const first = applyMove(state, { kind: 'switch' });
    if (first) {
      state = first;
      moves.push({ kind: 'switch' });
    }

    for (let step = 0; step < MAX_STEPS; step++) {
      const current = evaluate(state, samples, evalMode);
      let bestEval: Evaluation | null = null;
      let best: { move: Move; state: typeof state } | null = null;

      for (const move of listMoves(state)) {
        const next = applyMove(state, move);
        if (!next) continue;
        const e = evaluate(next, samples, evalMode);
        // お金を使う手は「出荷量か収入が増える」ときだけ打つ（連鎖数が増えるだけの買い物はしない）。
        // 無料の手（手持ちを置く）は、値を育てる（最大値が上がる）だけでも打つ
        const gains = e.score > current.score || e.income > current.income;
        const worthIt = move.kind === 'buyPlace' ? gains : compareEvaluation(e, current) > 0;
        if (!worthIt) continue;
        const cmp = bestEval ? compareEvaluation(e, bestEval) : 1;
        // 同じ評価なら、予算が多く残る（安い）手を選ぶ
        if (cmp > 0 || (cmp === 0 && best && next.budget > best.state.budget)) {
          bestEval = e;
          best = { move, state: next };
        }
      }

      if (best) {
        state = best.state;
        moves.push(best.move);
        continue;
      }
      if (rerolls < maxRerolls && canReroll(state, REROLL_RESERVE)) {
        const next = applyMove(state, { kind: 'reroll' });
        if (next) {
          state = next;
          moves.push({ kind: 'reroll' });
          rerolls++;
          continue;
        }
      }
      break;
    }
    return { state, moves };
  },
};
