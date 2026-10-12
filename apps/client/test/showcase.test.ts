/**
 * 見本の工場: 決めた見せ場になっているか（sim の数値を変えたら見本も見直す合図）
 */
import { scoreToString, type Score } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { EFFECTS_CONFIG } from '../src/config/effects';
const digitsOf = (s: Score) => scoreToString(s).length;
import { runShowcase, TITLE_SHOWCASE, TUTORIAL_SHOWCASE } from '../src/showcase/boards';

describe('見本の工場', () => {
  it('タイトルの見本は、カットインが出る大出荷（12 桁以上）を何度か出し、計測不能までは行かない', () => {
    const r = runShowcase(TITLE_SHOWCASE);
    expect(digitsOf(r.score)).toBeGreaterThanOrEqual(12);
    expect(digitsOf(r.score)).toBeLessThan(17);
    expect(r.stats.shipCount).toBeGreaterThanOrEqual(3);
    expect(r.stats.chainCount).toBeGreaterThanOrEqual(20);
    expect(r.stats.halted).toBeNull();
  });

  it('チュートリアルの見本は、カットインが出る大出荷になる', () => {
    const r = runShowcase(TUTORIAL_SHOWCASE);
    expect(digitsOf(r.score)).toBeGreaterThanOrEqual(EFFECTS_CONFIG.cutIn.minShipDigits);
    expect(digitsOf(r.score)).toBeLessThan(17);
    expect(r.stats.halted).toBeNull();
    expect(scoreToString(r.score)).toMatch(/^\d+$/);
  });
});
