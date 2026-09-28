/**
 * 表示名のルール
 *
 * NG ワードは最小限の仮リスト。運用で増やす（不適切な名前は players.hidden で個別に非表示にもできる）。
 * 照合は NFKC 正規化 + 小文字化した後の部分一致。
 */
export const NAME_RULES = {
  /** 最大文字数（正規化後、書記素ではなくコードポイントで数える） */
  maxLength: 12,
  /** 使える文字: 文字・数字・空白・一部の記号 */
  allowedPattern: /^[\p{L}\p{N} _\-・.]+$/u,
  ngWords: ['admin', 'administrator', 'official', '運営', '公式', 'fuck', 'shit'] as const,
};
