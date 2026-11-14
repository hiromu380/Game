import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import ja from '../src/i18n/ja.json';
import { makeT } from '../src/i18n';
import { bashoName, money, rankLabel, recordLabel } from '../src/format';

const t = makeT('ja');

describe('表示の整形', () => {
  it('地位: 東横綱・西前頭3枚目・東幕下15枚目・前相撲', () => {
    expect(rankLabel(t, { division: 'makuuchi', title: 'Y', number: 1, side: 'E' })).toBe('東横綱');
    expect(rankLabel(t, { division: 'makuuchi', title: 'M', number: 3, side: 'W' })).toBe(
      '西前頭3枚目',
    );
    expect(rankLabel(t, { division: 'makushita', title: null, number: 15, side: 'E' })).toBe(
      '東幕下15枚目',
    );
    expect(rankLabel(t, null)).toBe('前相撲');
  });

  it('お金: 万円の単位（1万円未満は円）', () => {
    expect(money(t, 12_340_000, 'ja')).toBe('1,234万円');
    expect(money(t, 8_200, 'ja')).toBe('8,200円');
    expect(money(makeT('en'), 12_340_000, 'en')).toBe('¥12.3M');
  });

  it('場所の名前と成績', () => {
    expect(bashoName(t, 0)).toBe('1年目 初場所');
    expect(bashoName(t, 9)).toBe('2年目 名古屋場所');
    expect(recordLabel(t, { wins: 8, losses: 7, absences: 0 })).toBe('8勝7敗');
    expect(recordLabel(t, { wins: 3, losses: 5, absences: 7 })).toBe('3勝5敗7休');
  });

  it('日本語と英語の文言のキーがそろっている', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ja).sort());
  });
});
