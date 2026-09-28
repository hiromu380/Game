/**
 * ボットの共通型
 *
 * ボットは1シフト分の「手」を決めて返す。実行側（runner.ts）はその手を記録しながら
 * 盤面に適用し、スイッチ（本番）を押す。ボットは本番シードを見ない。
 */
import type { Prng, RunState } from '@chain-factory/sim';
import type { Move } from '../moves';

export type BotName = 'random' | 'greedy' | 'mid' | 'search';

export interface BotOptions {
  /** ランダムな要素がある盤面を評価するときの試行回数 */
  samples: number;
  /** 1シフトあたりの思考時間の上限（ミリ秒）。探索ボットが使う */
  timeLimitMs: number;
  /** 1シフトあたりのリロール回数の上限 */
  maxRerolls: number;
  /** ボット自身の乱数（ランダムボット用。ゲームの乱数とは別） */
  rng: Prng;
}

export interface ShiftPlan {
  /** 手を打ち終えた状態（この状態でスイッチを押す） */
  state: RunState;
  /** 打った手（順番どおり） */
  moves: Move[];
}

export interface Bot {
  name: BotName;
  playShift(state: RunState, options: BotOptions): ShiftPlan;
}
