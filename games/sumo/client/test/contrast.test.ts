import { describe, expect, it } from 'vitest';
import { PALETTE as p } from '../src/art/palette';
function luminance(hex: string) {
  const channels = [1, 3, 5]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4));
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}
describe('本文・状態文字のコントラスト', () => {
  for (const [label, fg, bg] of [
    ['本文', p.sumi, p.washi],
    ['補足', p.muted, p.washi],
    ['カード補足', p.muted, p.card],
    ['勝ち越し', p.goodText, p.washi],
    ['警告', p.warning, p.washi],
    ['主ボタン', p.white, p.beni],
    ['ヘッダー', p.white, p.ai],
    ['地位', p.ai, p.odoLight],
    ['優勝', p.gold, p.goldBg],
  ]) {
    it(`${label}の文字は4.5:1以上`, () => {
      const [low, high] = [luminance(fg!), luminance(bg!)].sort((a, b) => a - b);
      expect((high! + 0.05) / (low! + 0.05)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
