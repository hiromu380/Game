import { scoreFromString } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import {
  formatCompactNumber,
  formatScoreNumber,
  NUMBER_FORMAT_CONFIG,
} from '../src/i18n/numberFormat';

const big = (digits: string) => scoreFromString(digits);

describe('大きな数の表記（日本語）', () => {
  it('4桁まではそのまま、それ以上は 万・億・兆… と単位を上げる', () => {
    expect(formatCompactNumber(big('9999'), 'ja')).toBe('9999');
    expect(formatCompactNumber(big('12345'), 'ja')).toBe('1.23万');
    expect(formatCompactNumber(big('10000'), 'ja')).toBe('1万');
    expect(formatCompactNumber(big('123456789'), 'ja')).toBe('1.23億');
    expect(formatCompactNumber(big('9876543210000'), 'ja')).toBe('9.87兆');
    expect(formatCompactNumber(big('1' + '0'.repeat(16)), 'ja')).toBe('1京');
  });

  it('単位の切り替わり目（1万・10万・100万・1000万）', () => {
    expect(formatCompactNumber(big('100000'), 'ja')).toBe('10万');
    expect(formatCompactNumber(big('1234567'), 'ja')).toBe('123万');
    expect(formatCompactNumber(big('12345678'), 'ja')).toBe('1234万');
  });

  it('最後の単位（極）を超えたら指数表記', () => {
    const units = NUMBER_FORMAT_CONFIG.jaUnits.length;
    const lastUnitDigits = (units + 1) * 4; // 極は 10^48
    expect(formatCompactNumber(big('1' + '0'.repeat(lastUnitDigits - 4)), 'ja')).toBe('1極');
    expect(formatCompactNumber(big('123' + '0'.repeat(50)), 'ja')).toBe('1.23e52');
  });
});

describe('大きな数の表記（英語）', () => {
  it('K・M・B・T… と単位を上げる', () => {
    expect(formatCompactNumber(big('9999'), 'en')).toBe('9,999');
    expect(formatCompactNumber(big('12345'), 'en')).toBe('12.3K');
    expect(formatCompactNumber(big('1234567'), 'en')).toBe('1.23M');
    expect(formatCompactNumber(big('999999999'), 'en')).toBe('999M');
    expect(formatCompactNumber(big('1000000000'), 'en')).toBe('1B');
    expect(formatCompactNumber(big('1' + '0'.repeat(12)), 'en')).toBe('1T');
  });

  it('最後の単位（Dc）を超えたら指数表記', () => {
    expect(formatCompactNumber(big('1' + '0'.repeat(33)), 'en')).toBe('1Dc');
    expect(formatCompactNumber(big('45' + '0'.repeat(35)), 'en')).toBe('4.5e36');
  });
});

describe('通常の表記（HUD・結果画面）', () => {
  it(`${NUMBER_FORMAT_CONFIG.fullMaxDigits} 桁までは桁区切り、それを超えたら単位つき`, () => {
    expect(formatScoreNumber('123456789012', 'ja')).toBe('123,456,789,012');
    expect(formatScoreNumber('1234567890123', 'ja')).toBe('1.23兆');
    expect(formatScoreNumber('1234567890123', 'en')).toBe('1.23T');
    expect(formatScoreNumber('0', 'en')).toBe('0');
  });
});
