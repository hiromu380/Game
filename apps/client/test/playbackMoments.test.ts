/**
 * 再生中の見せ場の連絡（state/playbackMoments.ts）: ボルトの気分と、出荷の箱
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  emitShipFlight,
  getBoltMood,
  notifyMoment,
  resetMoments,
  subscribeShipFlights,
} from '../src/state/playbackMoments';

afterEach(() => resetMoments());

describe('ボルトの気分', () => {
  it('連鎖の節目・ノルマ超えで喜び、桁上がり・ピークで驚く', () => {
    expect(getBoltMood().mood).toBeNull();
    notifyMoment('chainMilestone');
    expect(getBoltMood().mood).toBe('happy');
    notifyMoment('digitUp');
    expect(getBoltMood().mood).toBe('surprised');
    notifyMoment('quotaCross');
    expect(getBoltMood().mood).toBe('happy');
    notifyMoment('peak');
    expect(getBoltMood().mood).toBe('surprised');
  });

  it('同じ気分が続いても通し番号が進む（そのたびに跳ね直す）。戻すと既定になる', () => {
    notifyMoment('chainMilestone');
    const first = getBoltMood().beat;
    notifyMoment('chainMilestone');
    expect(getBoltMood().beat).toBe(first + 1);
    resetMoments();
    expect(getBoltMood().mood).toBeNull();
    // すでに既定なら何も変えない（余計な描き直しをしない）
    const rest = getBoltMood();
    resetMoments();
    expect(getBoltMood()).toBe(rest);
  });
});

describe('出荷の箱', () => {
  it('登録した相手に位置を伝え、解除したら伝えない', () => {
    const spy = vi.fn();
    const unsubscribe = subscribeShipFlights(spy);
    emitShipFlight({ clientX: 10, clientY: 20 });
    expect(spy).toHaveBeenCalledWith({ clientX: 10, clientY: 20 });
    unsubscribe();
    emitShipFlight({ clientX: 1, clientY: 2 });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
