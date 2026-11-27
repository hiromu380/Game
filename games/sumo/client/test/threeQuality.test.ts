import { describe, expect, it } from 'vitest';
import { chooseRenderQuality, shouldRenderFrame } from '../src/art/three/quality';

describe('3Dの表示性能', () => {
  it('スマホではDPRと描画負荷を抑える', () => {
    const q = chooseRenderQuality(390, 272, 3, true);
    expect(q.pixelRatio).toBeLessThanOrEqual(1.3);
    expect(q.maxFps).toBe(30);
    expect(390 * 272 * q.pixelRatio ** 2).toBeLessThanOrEqual(q.maxPixels);
  });

  it('PCでは縦横の大きな描画領域を制限する', () => {
    const q = chooseRenderQuality(1920, 1080, 2, false);
    expect(1920 * 1080 * q.pixelRatio ** 2).toBeLessThanOrEqual(q.maxPixels);
    expect(q.maxFps).toBe(45);
  });

  it('異常なDPR・寸法にも有限の値を返す', () => {
    const q = chooseRenderQuality(NaN, Infinity, Infinity, false);
    expect(Number.isFinite(q.pixelRatio)).toBe(true);
    expect(q.pixelRatio).toBeGreaterThan(0);
  });

  it('途中のフレームは間引き、勝敗確定と最終フレームは描く', () => {
    expect(shouldRenderFrame(10, 0, 30, true, false)).toBe(false);
    expect(shouldRenderFrame(40, 0, 30, true, false)).toBe(true);
    expect(shouldRenderFrame(10, 0, 30, true, true)).toBe(true);
    expect(shouldRenderFrame(10, 0, 30, false, false)).toBe(true);
  });
});
