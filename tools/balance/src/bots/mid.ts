/**
 * 中級ボット: 貪欲ボット ＋ 配置の組み替え
 *
 * 「普通に遊ぶ人」の物差し（目標クリア率 50〜70%）として使う。
 * - 1手先だけを読む（探索ボットのように数手先の組み合わせは考えない）
 * - 貪欲ボットの手（手持ちを置く・買って置く）に加えて、置いたパーツの「回転」「移動」も打てる
 *   （手持ちに戻すのは無料なので、実際のプレイヤーもよくやる）
 * - シフトの始めに「今の盤面に足していく」と「いったん全部戻して置き直す」の両方を試し、良い方を選ぶ
 */
import type { RunState } from '@chain-factory/sim';
import { compareEvaluation, evaluate, type Evaluation } from '../evaluate';
import {
  applyMove,
  canReroll,
  listMoves,
  listRearrangeMoves,
  returnAll,
  type Move,
} from '../moves';
import type { Bot, BotOptions, ShiftPlan } from './types';

/** リロールしても予算を残す額（貪欲ボットと同じ） */
const REROLL_RESERVE = 4;
/** 1シフトで打つ手の上限（組み替えは手数が増えるので貪欲ボットより多め） */
const MAX_STEPS = 60;

export const midBot: Bot = {
  name: 'mid',
  playShift(initial, options) {
    const keep = improve(initial, [], options);
    const cleared = returnAll(initial);
    if (!cleared) return keep;
    const rebuilt = improve(cleared.state, cleared.moves, options);
    const a = evaluate(keep.state, options.samples);
    const b = evaluate(rebuilt.state, options.samples);
    const cmp = compareEvaluation(b, a) || rebuilt.state.budget - keep.state.budget;
    return cmp > 0 ? rebuilt : keep;
  },
};

/** 評価が上がる手を1つずつ打ち続ける（上がる手がなければリロール、それもできなければ終わる） */
function improve(start: RunState, prefix: Move[], { samples, maxRerolls }: BotOptions): ShiftPlan {
  let state = start;
  const moves: Move[] = [...prefix];
  let rerolls = 0;

  const first = applyMove(state, { kind: 'switch' });
  if (first) {
    state = first;
    moves.push({ kind: 'switch' });
  }

  for (let step = 0; step < MAX_STEPS; step++) {
    const current = evaluate(state, samples);
    let bestEval: Evaluation | null = null;
    let best: { move: Move; state: RunState } | null = null;

    for (const move of [...listMoves(state), ...listRearrangeMoves(state)]) {
      const next = applyMove(state, move);
      if (!next) continue;
      const e = evaluate(next, samples);
      // お金を使う手は出荷量か収入が増えるときだけ（貪欲ボットと同じ基準）。無料の手は評価が上がれば打つ
      const gains = e.score > current.score || e.income > current.income;
      const worthIt = move.kind === 'buyPlace' ? gains : compareEvaluation(e, current) > 0;
      if (!worthIt) continue;
      const cmp = bestEval ? compareEvaluation(e, bestEval) : 1;
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
}
