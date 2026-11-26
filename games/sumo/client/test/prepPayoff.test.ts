import { describe, expect, it } from 'vitest';
import type { BashoRecord } from '@ichimon/sim';
import { outcomeOf, prepPayoff } from '../src/prepPayoff';

const rec = (wins: number, losses: number, absences = 0): BashoRecord =>
  ({
    bashoIndex: 0,
    rank: { division: 'makushita', number: 1, side: 'E' },
    wins,
    losses,
    absences,
    yusho: false,
  }) as BashoRecord;

describe('場所前の稽古と成績', () => {
  it('成績は全休・勝ち越し・負け越しのどれか1つ', () => {
    expect(outcomeOf(rec(0, 0, 7))).toBe('kyujo');
    expect(outcomeOf(rec(4, 3))).toBe('kachi');
    expect(outcomeOf(rec(3, 4))).toBe('make');
    expect(outcomeOf(rec(3, 2, 2))).toBe('make');
    expect(outcomeOf(rec(8, 7))).toBe('kachi');
  });

  it('稽古をつけた弟子を伸びた順に並べ、つけなかった弟子と勝ち越しの数を比べる', () => {
    const mine = [
      { id: 1, record: rec(5, 2), bouts: [] },
      { id: 2, record: rec(2, 5), bouts: [] },
      { id: 3, record: rec(4, 3), bouts: [] },
      { id: 4, record: rec(0, 0, 7), bouts: [] },
    ];
    const p = prepPayoff({
      mine,
      prep: [
        { id: 2, gain: 1, walls: 0, weeks: 1 },
        { id: 1, gain: 4, walls: 1, weeks: 2 },
        { id: 9, gain: 3, walls: 0, weeks: 1 },
      ],
    })!;
    expect(p.rows.map((r) => r.id)).toEqual([1, 2]);
    expect(p.trained).toEqual({ n: 2, kachi: 1 });
    // 全休の弟子は取組がないので数えない
    expect(p.others).toEqual({ n: 1, kachi: 1 });
  });

  it('稽古をつけなかった場所・古い結果では出さない', () => {
    expect(prepPayoff({ mine: [], prep: undefined })).toBeNull();
    expect(prepPayoff({ mine: [], prep: [{ id: 1, gain: 1, walls: 0, weeks: 1 }] })).toBeNull();
  });
});
