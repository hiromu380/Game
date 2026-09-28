import { scoreFromString, scoreOf } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import {
  compareRankKey,
  compareScoreColumns,
  fromScoreColumns,
  SCORE_HEAD_DIGITS,
  toScoreColumns,
  topPercent,
  type RankKey,
} from '../src';

describe('スコアの3列表現', () => {
  it('桁数・先頭15桁・完全な値に分け、元に戻せる', () => {
    const big = scoreFromString('123456789012345678901234567890');
    const cols = toScoreColumns(big);
    expect(cols).toEqual({
      digits: 30,
      head: 123456789012345,
      text: '123456789012345678901234567890',
    });
    expect(fromScoreColumns(cols)).toBe(big);
    expect(toScoreColumns(scoreOf(0))).toEqual({ digits: 1, head: 0, text: '0' });
  });

  it('先頭15桁は number で誤差なく表せる', () => {
    const max = toScoreColumns(scoreFromString('9'.repeat(40)));
    expect(max.head).toBe(999_999_999_999_999);
    expect(Number.isSafeInteger(max.head)).toBe(true);
    expect(SCORE_HEAD_DIGITS).toBe(15);
  });

  it('比較: 桁数 → 先頭15桁 → 完全な値の順で、bigint の大小と一致する', () => {
    const values = [
      '0',
      '9',
      '10',
      '999999999999999',
      '1000000000000000',
      '1000000000000000000000001',
      '1000000000000000000000002',
      '2' + '0'.repeat(40),
    ];
    for (const a of values) {
      for (const b of values) {
        const expected = BigInt(a) === BigInt(b) ? 0 : BigInt(a) > BigInt(b) ? 1 : -1;
        const actual = Math.sign(
          compareScoreColumns(
            toScoreColumns(scoreFromString(a)),
            toScoreColumns(scoreFromString(b)),
          ),
        );
        expect(actual).toBe(expected);
      }
    }
  });
});

describe('ランキングの並び順', () => {
  const key = (shiftsCleared: number, score: string, submittedAt: number): RankKey => ({
    shiftsCleared,
    score: toScoreColumns(scoreFromString(score)),
    submittedAt,
  });

  it('クリアしたシフト数 → 合計出荷量 → 提出時刻（早い順）', () => {
    const entries = [key(2, '999999', 1), key(3, '100', 5), key(3, '5000', 9), key(3, '5000', 3)];
    const sorted = [...entries].sort(compareRankKey);
    expect(sorted).toEqual([
      key(3, '5000', 3),
      key(3, '5000', 9),
      key(3, '100', 5),
      key(2, '999999', 1),
    ]);
  });

  it('上位○%', () => {
    expect(topPercent(1, 1000)).toBe(1);
    expect(topPercent(50, 1000)).toBe(5);
    expect(topPercent(1000, 1000)).toBe(100);
    expect(topPercent(1, 0)).toBe(100);
  });
});
