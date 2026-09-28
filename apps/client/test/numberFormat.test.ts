import { scoreFromString } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import {
  formatCompactNumber,
  formatScoreNumber,
  NUMBER_FORMAT_CONFIG,
} from '../src/i18n/numberFormat';

const big = (digits: string) => scoreFromString(digits);

describe('大きな数の表記（日本語・英語とも K・M・B）', () => {
  it('4桁まではそのまま、それ以上は K・M・B・T… と単位を上げる', () => {
    for (const lang of ['ja', 'en'] as const) {
      expect(formatCompactNumber(big('9999'), lang)).toBe('9,999');
      expect(formatCompactNumber(big('12345'), lang)).toBe('12.3K');
      expect(formatCompactNumber(big('1234567'), lang)).toBe('1.23M');
      expect(formatCompactNumber(big('999999999'), lang)).toBe('999M');
      expect(formatCompactNumber(big('1000000000'), lang)).toBe('1B');
      expect(formatCompactNumber(big('1' + '0'.repeat(12)), lang)).toBe('1T');
    }
  });

  it('単位の切り替わり目（10K・100K・1M）', () => {
    expect(formatCompactNumber(big('10000'), 'ja')).toBe('10K');
    expect(formatCompactNumber(big('100000'), 'ja')).toBe('100K');
    expect(formatCompactNumber(big('1000000'), 'ja')).toBe('1M');
  });

  it('最後の単位（Dc）を超えたら指数表記', () => {
    const lastUnitZeros = NUMBER_FORMAT_CONFIG.units.length * 3; // Dc は 10^33
    expect(formatCompactNumber(big('1' + '0'.repeat(lastUnitZeros)), 'ja')).toBe('1Dc');
    expect(formatCompactNumber(big('45' + '0'.repeat(35)), 'ja')).toBe('4.5e36');
  });
});

describe('通常の表記（HUD・結果画面）', () => {
  it(`${NUMBER_FORMAT_CONFIG.fullMaxDigits} 桁までは桁区切り、それを超えたら単位つき`, () => {
    expect(formatScoreNumber('123456789012', 'ja')).toBe('123,456,789,012');
    expect(formatScoreNumber('1234567890123', 'ja')).toBe('1.23T');
    expect(formatScoreNumber('0', 'en')).toBe('0');
  });
});
