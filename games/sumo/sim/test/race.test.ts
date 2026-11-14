import { describe, expect, it } from 'vitest';
import { advanceBasho, createGame, type BoutResult } from '../src';
import { yushoRace } from '../src/basho/race';

const bout = (day: number, e: number, w: number, winner: number): BoutResult => ({
  day,
  eastId: e,
  westId: w,
  winnerId: winner,
  kimarite: 'yorikiri',
  kensho: 0,
  fusen: false,
});

describe('幕内の優勝争い', () => {
  it('場所の結果に、日ごとの先頭・優勝の目・結びの一番が入る', () => {
    let s = createGame({ seed: 4 });
    for (let i = 0; i < 6; i++) {
      s = advanceBasho({ ...s, pending: { ...s.pending, happening: null } });
      const r = s.lastReport!;
      const race = r.race!;
      const winner = r.yusho.makuuchi!;
      expect(race.leaders.map((l) => l.day)).toEqual([10, 11, 12, 13, 14, 15]);
      expect(race.leaders[5]!.ids).toContain(winner);
      expect(race.contenders.map((c) => c.id)).toContain(winner);
      expect(race.decidedDay).toBeGreaterThanOrEqual(8);
      expect(race.decidedDay).toBeLessThanOrEqual(16);
      expect(race.decidedDay === 16).toBe(r.playoff !== null);
      expect(race.musubi!.day).toBe(15);
      if (race.decidedDay === 15) {
        expect([race.deciding!.eastId, race.deciding!.westId]).toContain(winner);
      } else expect(race.deciding).toBeNull();
    }
  });

  it('優勝が決まった日: ほかの誰も残りを全部勝っても届かなくなった日', () => {
    // 3人で15日。1が毎日勝ち、2・3は1にだけ負ける（2と3は互いに当たらない架空の割）
    const bouts: BoutResult[] = [];
    for (let day = 1; day <= 15; day++) {
      const other = day % 2 === 0 ? 2 : 3;
      bouts.push(bout(day, 1, other, 1));
    }
    const race = yushoRace([1, 2, 3], bouts, 1, false);
    // 5日目: 1 は5勝、2 は残り5番（6〜14日目の偶数日）を全部勝てば並ぶ。
    // 6日目: 1 は6勝、2 は残り4番・3 は残り5番で届かない
    expect(race.decidedDay).toBe(6);
    expect(race.leaders[5]).toEqual({ day: 15, wins: 15, losses: 0, ids: [1] });
    expect(race.deciding).toBeNull();
    // 決定戦なら 16
    expect(yushoRace([1, 2, 3], bouts, 1, true).decidedDay).toBe(16);
  });
});
