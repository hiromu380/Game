/**
 * 再生中の出荷量の途中経過（state/liveScore.ts）: 変わったときだけ、読んでいる側に知らせる
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLiveScore, setLiveScore, subscribeLiveScore } from '../src/state/liveScore';

afterEach(() => setLiveScore(null));

describe('出荷量の途中経過', () => {
  it('入れた値を読める。null で消える', () => {
    expect(getLiveScore()).toBeNull();
    setLiveScore('120');
    expect(getLiveScore()).toBe('120');
    setLiveScore(null);
    expect(getLiveScore()).toBeNull();
  });

  it('同じ値を入れ直しても知らせない（余計な描き直しをしない）', () => {
    const spy = vi.fn();
    const unsubscribe = subscribeLiveScore(spy);
    setLiveScore('5');
    setLiveScore('5');
    setLiveScore('6');
    expect(spy).toHaveBeenCalledTimes(2);
    unsubscribe();
    setLiveScore('7');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
