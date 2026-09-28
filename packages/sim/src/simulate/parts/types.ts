/**
 * パーツの挙動定義の共通型
 *
 * パーツ1種 = 1ファイルで PartBehavior を実装し、index.ts の一覧に登録する。
 * 新しいパーツを追加するときは、ファイルを1つ足して一覧に加えるだけでよい。
 */
import type { Prng } from '../../core/prng';
import type { Score } from '../../core/score';
import type { Board, Dir8, Part, RuleSet } from '../../types';

/** パーツの反応に渡される共通の情報 */
interface BaseContext {
  part: Part;
  x: number;
  y: number;
  board: Board;
  rules: RuleSet;
  /** シード付き乱数（使う順序も決定論的であること） */
  rng: Prng;
  /** その時点までの連鎖数（この発動は含まない） */
  chainCount: number;
  /**
   * このマスのパーツがシミュレーション中に持つ状態（初期値 0）。
   * 回転台の「何回回ったか」などに使う。Reaction.nextState で更新する
   */
  state: number;
}

/** パーツが信号を1本受けたときに渡される情報 */
export interface ReactionContext extends BaseContext {
  /** 受けた信号の値 */
  value: Score;
  /** 受けた信号の進行方向 */
  inDir: Dir8;
}

/** tick の終わりにまとめて処理するパーツ（合流炉）に渡される情報 */
export interface CollectContext extends BaseContext {
  /** この tick に受けた信号の値（受けた順） */
  values: Score[];
}

/** 信号の発射 */
export interface Emission {
  dir: Dir8;
  value: Score;
  /** 何 tick 遅れて発射するか（省略時 0 = すぐ） */
  delay?: number;
}

/** パーツの反応結果 */
export interface Reaction {
  /** 新しく発射する信号（パーツのマスから、指定方向へ） */
  emits?: Emission[];
  /** 出荷量に加算する値 */
  ship?: Score;
  /** 発動回数をリセットするマスの座標 */
  resets?: [number, number][];
  /** 次シフトの予算に加える値（1回のシミュレーションの上限は rules.maxIncomePerSim） */
  income?: number;
  /** このマスの状態を更新する */
  nextState?: number;
}

/** 常時効果（潤滑油タンクなど）: シミュレーション開始時に1度だけ評価する */
export interface PassiveEffect {
  /** 指定マスのパーツの発動回数上限を増減する */
  activationBonus?: { x: number; y: number; delta: number }[];
}

export interface PartBehavior {
  /**
   * 信号を1本受けたときの反応。null の場合、そのパーツは信号に反応せず、
   * 入ってきた信号は消滅する（例: スイッチ、潤滑油タンク）
   */
  react: ((ctx: ReactionContext) => Reaction) | null;
  /**
   * 指定すると、同じ tick に入った信号をまとめて tick の終わりに1回だけ処理する。
   * 発動回数は「信号を受けた tick ごとに1回」と数える（合流炉）
   */
  collect?: (ctx: CollectContext) => Reaction;
  /** 常時効果 */
  passive?: (ctx: Omit<BaseContext, 'rng' | 'chainCount' | 'state'>) => PassiveEffect;
}
