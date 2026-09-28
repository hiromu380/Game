/**
 * 探索ボット: ビームサーチで「数手先まで」考える
 *
 * 各段階で良い状態を beamWidth 個だけ残しながら手を重ね、最後に最も評価の高い状態を選ぶ。
 * 貪欲ボットと違い、その場では評価が上がらない手（先に出荷口を置く等）も候補に残るので、
 * 2〜3手を組み合わせて初めて効く配置を見つけられる。
 * 計算量が大きいため、1シフトあたりの思考時間に上限を設けている。
 */
import type { RunState } from '@chain-factory/sim';
import { compareEvaluation, compareOutlook, evaluate, type Evaluation } from '../evaluate';
import { applyMove, canReroll, listMoves, type Move } from '../moves';
import type { Bot, BotOptions, ShiftPlan } from './types';

const BEAM_WIDTH = 6;
/** 1つの状態から次の段階へ残す手の数 */
const BRANCH = 8;
const MAX_DEPTH = 12;
const REROLL_RESERVE = 4;

interface Node {
  state: RunState;
  moves: Move[];
  eval: Evaluation;
  rerolls: number;
}

/** 探索中の並べ方: 見込み込みの評価の降順。同じなら予算が多い方を上に */
function compareNodes(a: Node, b: Node): number {
  return compareOutlook(b.eval, a.eval) || b.state.budget - a.state.budget;
}

/** 最終的に選ぶときの並べ方: 実際の評価（見込みは含めない）の降順 */
function compareFinal(a: Node, b: Node): number {
  return compareEvaluation(b.eval, a.eval) || b.state.budget - a.state.budget;
}

/** 同じ盤面・予算・手持ち・ショップの状態は1つにまとめる */
function keyOf(state: RunState): string {
  return JSON.stringify([state.board.cells, state.budget, state.inventory, state.shop]);
}

export const searchBot: Bot = {
  name: 'search',
  playShift(initial, options) {
    // 案A: 今の盤面に足していく／案B: いったん全部手持ちに戻して組み直す（手持ちに戻すのは無料）
    // 思考時間を半分ずつ使い、良い方を選ぶ
    const half = { ...options, timeLimitMs: options.timeLimitMs / 2 };
    const keep = beamSearch(initial, [], half);
    const cleared = clearBoard(initial);
    if (!cleared) return keep;
    const rebuilt = beamSearch(cleared.state, cleared.moves, half);
    const a = evaluate(keep.state, options.samples);
    const b = evaluate(rebuilt.state, options.samples);
    const cmp = compareEvaluation(b, a) || rebuilt.state.budget - keep.state.budget;
    return cmp > 0 ? rebuilt : keep;
  },
};

/** 盤面のパーツ（スイッチ以外）をすべて手持ちに戻す。戻すものがなければ null */
function clearBoard(state: RunState): { state: RunState; moves: Move[] } | null {
  let current = state;
  const moves: Move[] = [];
  state.board.cells.forEach((part, index) => {
    if (!part || part.id === 'switch') return;
    const x = index % state.board.width;
    const y = Math.floor(index / state.board.width);
    const move: Move = { kind: 'return', x, y };
    const next = applyMove(current, move);
    if (next) {
      current = next;
      moves.push(move);
    }
  });
  return moves.length > 0 ? { state: current, moves } : null;
}

function beamSearch(
  initial: RunState,
  prefix: Move[],
  { samples, timeLimitMs, maxRerolls }: BotOptions,
): ShiftPlan {
  const started = performance.now();
  let start = initial;
  const startMoves: Move[] = [...prefix];
  const placed = applyMove(start, { kind: 'switch' });
  if (placed) {
    start = placed;
    startMoves.push({ kind: 'switch' });
  }

  const root: Node = {
    state: start,
    moves: startMoves,
    eval: evaluate(start, samples),
    rerolls: 0,
  };
  let beam: Node[] = [root];
  let best = root;

  for (let depth = 0; depth < MAX_DEPTH; depth++) {
    if (performance.now() - started > timeLimitMs) break;
    const children = new Map<string, Node>();

    /** リロールした子（ショップが変わるので、評価が同じでも必ず探索に残す） */
    let rerollChild: Node | null = null;

    for (const node of beam) {
      const expanded: Node[] = [];
      for (const move of listMoves(node.state)) {
        const next = applyMove(node.state, move);
        if (!next) continue;
        const child: Node = {
          state: next,
          moves: [...node.moves, move],
          eval: evaluate(next, samples),
          rerolls: node.rerolls,
        };
        // 何も良くならない手は捨てる（お金の無駄遣いを探索しないため）。
        // 「見込みが増える」か「実際の評価が上がる」（見込みを出荷に変えた）手だけを残す
        if (
          compareOutlook(child.eval, node.eval) > 0 ||
          compareEvaluation(child.eval, node.eval) > 0
        ) {
          expanded.push(child);
        }
        if (performance.now() - started > timeLimitMs) break;
      }
      expanded.sort(compareNodes);
      for (const child of expanded.slice(0, BRANCH)) {
        const key = keyOf(child.state);
        const existing = children.get(key);
        if (!existing || child.moves.length < existing.moves.length) children.set(key, child);
      }

      if (node.rerolls < maxRerolls && canReroll(node.state, REROLL_RESERVE)) {
        const next = applyMove(node.state, { kind: 'reroll' });
        if (next && (!rerollChild || compareNodes({ ...node, state: next }, rerollChild) < 0)) {
          rerollChild = {
            state: next,
            moves: [...node.moves, { kind: 'reroll' }],
            eval: node.eval,
            rerolls: node.rerolls + 1,
          };
        }
      }
    }

    const ranked = [...children.values()].sort(compareNodes);
    beam = ranked.slice(0, rerollChild ? BEAM_WIDTH - 1 : BEAM_WIDTH);
    if (rerollChild) beam.push(rerollChild);
    if (beam.length === 0) break;
    for (const node of beam) if (compareFinal(node, best) < 0) best = node;
  }

  return { state: best.state, moves: best.moves };
}
