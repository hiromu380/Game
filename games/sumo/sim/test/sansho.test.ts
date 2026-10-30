import { describe, expect, it } from 'vitest';
import { advanceBasho, createGame, ranksOf, type BoutResult, type Rank } from '../src';
import { selectSansho } from '../src/basho/sansho';

const r = (title: Rank['title'], number = 1): Rank => ({
  division: 'makuuchi',
  title,
  number,
  side: 'E',
});
const bout = (winnerId: number, loserId: number, kimarite = 'yorikiri'): BoutResult => ({
  day: 1,
  eastId: winnerId,
  westId: loserId,
  winnerId,
  kimarite,
  kensho: 0,
  fusen: false,
});

describe('三賞の選考', () => {
  const ranks = new Map<number, Rank>([
    [1, r('Y')],
    [2, r('O')],
    [3, r('M', 3)],
    [4, r('M', 10)],
    [5, r('K')],
    [6, { division: 'juryo', title: null, number: 1, side: 'E' }],
  ]);
  const rec = (wins: number) => ({ wins, losses: 15 - wins, absences: 0 });

  it('殊勲賞: 横綱・大関を倒して10勝以上。横綱・大関・十両は対象外', () => {
    const records = new Map([
      [1, rec(13)],
      [2, rec(12)],
      [3, rec(10)],
      [4, rec(9)],
      [5, rec(8)],
      [6, rec(14)],
    ]);
    const s = selectSansho(ranks, records, [bout(3, 1), bout(4, 2)], undefined);
    expect(s.shukun).toEqual([3]); // 4 は 9勝で足りない
  });

  it('敢闘賞: 11勝以上（優勝した平幕は勝ち星に関係なく）。負け越しは対象外', () => {
    const records = new Map([
      [1, rec(10)],
      [2, rec(10)],
      [3, rec(11)],
      [4, rec(10)],
      [5, rec(7)],
      [6, rec(12)],
    ]);
    expect(selectSansho(ranks, records, [], undefined).kanto).toEqual([3]);
    expect(selectSansho(ranks, records, [], 4).kanto).toEqual([3, 4]);
  });

  it('技能賞: 10勝以上で違う決まり手が4つ以上。該当者なしもある', () => {
    const records = new Map([
      [1, rec(10)],
      [2, rec(10)],
      [3, rec(10)],
      [4, rec(10)],
      [5, rec(10)],
      [6, rec(10)],
    ]);
    const varied = ['yorikiri', 'uwatenage', 'hatakikomi', 'okuridashi'].map((k) => bout(5, 4, k));
    expect(selectSansho(ranks, records, varied, undefined).gino).toEqual([5]);
    expect(selectSansho(ranks, records, [bout(5, 4)], undefined).gino).toEqual([]);
  });
});

describe('場所の結果の三賞と決定戦', () => {
  it('三賞の受賞者は関脇以下の幕内で、回数が記録に残る', () => {
    let s = createGame({ seed: 31 });
    let found = 0;
    for (let i = 0; i < 6; i++) {
      const before = ranksOf(s.banzuke, s.titles);
      s = advanceBasho(s);
      for (const ids of Object.values(s.lastReport!.sansho)) {
        for (const id of ids) {
          const rank = before.get(id)!;
          expect(rank.division).toBe('makuuchi');
          expect(['S', 'K', 'M']).toContain(rank.title);
          found++;
        }
      }
    }
    expect(found).toBeGreaterThan(0);
    const total = s.rikishi.reduce(
      (n, r) => n + r.career.sansho.shukun + r.career.sansho.kanto + r.career.sansho.gino,
      0,
    );
    expect(total).toBeGreaterThan(0);
  });

  it('決定戦があれば、優勝者は決定戦に出た力士のひとり', () => {
    let s = createGame({ seed: 5 });
    for (let i = 0; i < 12; i++) {
      s = advanceBasho(s);
      const p = s.lastReport!.playoff;
      if (p) expect(p).toContain(s.lastReport!.yusho.makuuchi);
    }
  });
});
