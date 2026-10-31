/**
 * 番付の定員と動き（docs/realism.md。序二段・序ノ口の割合と枚数の動きは目安）
 */
import type { Division } from '../model/types';

export const DIVISIONS: readonly Division[] = [
  'makuuchi',
  'juryo',
  'makushita',
  'sandanme',
  'jonidan',
  'jonokuchi',
];

/** 定員（人数。東西あわせて） */
export const DIVISION_SIZE = { makuuchi: 42, juryo: 28, makushita: 120, sandanme: 180 } as const;

/** 序ノ口の人数 = 残りの人数 × この割合（最小・最大つき） */
export const JONOKUCHI_SHARE = { ratio: 0.2, min: 10, max: 70 };

/** 取組の数 */
export const BOUTS = { sekitori: 15, lower: 7 };

/** 勝ち越し1つ（勝ち − 負け）で動く枚数の目安 */
export const MOVE_PER_NET: Record<Division, number> = {
  makuuchi: 1.2,
  juryo: 1.2,
  makushita: 5,
  sandanme: 9,
  jonidan: 14,
  jonokuchi: 14,
};

/** 三役（関脇・小結）の最低人数 */
export const MIN_SANYAKU = { S: 2, K: 2 };

/** 大関・横綱の昇進と大関の陥落（目安） */
export const PROMOTION = {
  /** 大関: 三役で直近3場所の勝ち星の合計 */
  ozekiWins3: 33,
  /** 大関: 昇進を決める場所の最低勝ち星 */
  ozekiLastMin: 10,
  /** 大関から落ちた翌場所に、この勝ち星で大関へ戻る */
  ozekiReturnWins: 10,
  /** 横綱: 大関で2場所続けて優勝、または片方優勝でもう片方が準ずる成績（下の勝ち星以上）。合計の勝ち星も見る */
  yokozunaWins2: 26,
  yokozunaOtherMin: 12,
};
