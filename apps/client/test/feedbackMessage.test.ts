import { describe, expect, it } from 'vitest';
import { feedbackMessage } from '../src/state/feedbackMessage';

describe('操作の手応えの表示', () => {
  it('お金が動く操作は金額つきで出す', () => {
    expect(feedbackMessage('buy', -3)).toEqual({ kind: 'buy', amount: 3 });
    expect(feedbackMessage('reroll', -1)).toEqual({ kind: 'reroll', amount: 1 });
    expect(feedbackMessage('sell', 2)).toEqual({ kind: 'sell', amount: 2 });
  });

  it('予算が減らない「購入」の手応え（今日の出来事を選んだとき）は出さない', () => {
    expect(feedbackMessage('buy', 5)).toBeNull();
    expect(feedbackMessage('buy', 0)).toBeNull();
  });

  it('盤面で見てわかる操作とエラーは出さない', () => {
    for (const kind of ['place', 'rotate', 'returnPart', 'error'] as const) {
      expect(feedbackMessage(kind, 0)).toBeNull();
    }
    expect(feedbackMessage('undo', 0)).toEqual({ kind: 'undo', amount: 0 });
  });
});
