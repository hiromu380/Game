/**
 * パーツの挙動定義の共通型
 *
 * パーツ1種 = 1ファイルで PartBehavior を実装し、index.ts の一覧に登録する。
 * 新しいパーツを追加するときは、ファイルを1つ足して一覧に加えるだけでよい。
 */
import type { Score } from '../../core/score';
import type { Prng } from '../../core/prng';
import type { Board, Dir8, Part, RuleSet } from '../../types';

/** パーツが信号を受けたときに渡される情報 */
export interface ReactionContext {
  part: Part;
  x: number;
  y: number;
  /** 受けた信号の値 */
  value: Score;
  /** 受けた信号の進行方向 */
  inDir: Dir8;
  board: Board;
  rules: RuleSet;
  /** シード付き乱数（使う順序も決定論的であること） */
  rng: Prng;
}

/** パーツの反応結果 */
export interface Reaction {
  /** 新しく発射する信号（パーツのマスから、指定方向へ） */
  emits?: { dir: Dir8; value: Score }[];
  /** 出荷量に加算する値 */
  ship?: Score;
  /** 発動回数をリセットするマスの座標 */
  resets?: [number, number][];
}

export interface PartBehavior {
  /**
   * 信号を受けたときの反応。null の場合、そのパーツは信号に反応せず、
   * 入ってきた信号は消滅する（例: スイッチ）
   */
  react: ((ctx: ReactionContext) => Reaction) | null;
}
