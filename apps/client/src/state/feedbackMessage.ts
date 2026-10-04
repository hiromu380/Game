/**
 * 操作の手応えの短い表示（購入 −3円・売却 +1円 など。純粋関数）
 *
 * 盤面で見てわかる操作（配置・回転・戻す）とエラー（別の表示がある）は出さない。
 * 文言は i18n の `toast.<kind>`
 */
import type { FeedbackKind } from './gameReducer';

export interface FeedbackMessage {
  kind: 'buy' | 'sell' | 'reroll' | 'useItem' | 'undo';
  /** 予算の増減の大きさ（円。増減がない操作は 0） */
  amount: number;
}

export function feedbackMessage(kind: FeedbackKind, budgetDelta: number): FeedbackMessage | null {
  switch (kind) {
    case 'buy':
    case 'reroll':
      // 今日の出来事を選んだとき（同じ手応え）は予算が減らないので出さない
      return budgetDelta < 0 ? { kind, amount: -budgetDelta } : null;
    case 'sell':
      return { kind, amount: Math.max(0, budgetDelta) };
    case 'useItem':
    case 'undo':
      return { kind, amount: 0 };
    default:
      return null;
  }
}
