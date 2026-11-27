import { describe, expect, it } from 'vitest';
import { createGame, type Alumnus, type GameState, type Rank } from '@ichimon/sim';
import { fameReasons, hallOfFame, recordsBroken, stableRecords } from '../src/records';

const Y: Rank = { division: 'makuuchi', title: 'Y', number: 1, side: 'E' };
const M: Rank = { division: 'makuuchi', title: 'M', number: 5, side: 'W' };

function withAlumni(s: GameState, list: Partial<Alumnus['career']>[]): GameState {
  const g: GameState = JSON.parse(JSON.stringify(s));
  const base = g.rikishi[0]!.career;
  g.player.alumni = list.map((c, i) => ({
    id: 900_000 + i,
    name: `元弟子${i}`,
    retiredAge: 33,
    retiredBashoIndex: i,
    generation: 1,
    becameOyakata: false,
    foreign: false,
    career: { ...base, ...c },
    track: [],
  }));
  return g;
}

function mine(g: GameState) {
  return g.rikishi.find((r) => r.stableId === g.player.stableId)!;
}

describe('部屋の歴代記録', () => {
  const s = createGame({ seed: 3 });

  it('元弟子と今の弟子を項目ごとに多い順に並べ、0は載せない', () => {
    const g = withAlumni(s, [{ wins: 300 }, { wins: 500 }, { wins: 0 }]);
    mine(g).career.wins = 400;
    mine(g).career.basho = 10;
    const wins = stableRecords(g).find((r) => r.key === 'wins')!.holders;
    expect(wins.map((h) => h.value)).toEqual([500, 400, 300]);
    expect(wins[1]!.active).toBe(true);
    expect(wins[0]!.active).toBe(false);
  });

  it('今の弟子が記録を塗り替えたら知らせる。下限に届かない・同じ人なら知らせない', () => {
    const prev = withAlumni(s, [{ wins: 300 }]);
    mine(prev).career.basho = 10;
    mine(prev).career.wins = 290;
    const next: GameState = JSON.parse(JSON.stringify(prev));
    mine(next).career.wins = 305;
    const news = recordsBroken(prev, next).filter((n) => n.key === 'wins');
    expect(news).toHaveLength(1);
    expect(news[0]!.previous.value).toBe(300);
    expect(news[0]!.holder.id).toBe(mine(next).id);
    // もう自分が記録の持ち主なら、伸ばしても知らせない
    const later: GameState = JSON.parse(JSON.stringify(next));
    mine(later).career.wins = 320;
    expect(recordsBroken(next, later).some((n) => n.key === 'wins')).toBe(false);
    // 下限（200勝）に届かない記録は知らせない
    const small = withAlumni(s, [{ wins: 50 }]);
    mine(small).career.basho = 10;
    const small2: GameState = JSON.parse(JSON.stringify(small));
    mine(small2).career.wins = 60;
    expect(recordsBroken(small, small2).some((n) => n.key === 'wins')).toBe(false);
  });

  it('殿堂: 横綱・大関・幕内優勝・三賞5回以上。最高位の高い順', () => {
    const g = withAlumni(s, [
      { highestRank: M, highestOrder: 20 },
      { highestRank: M, highestOrder: 15, makuuchiYusho: 1 },
      { highestRank: Y, highestOrder: 0 },
      { highestRank: M, highestOrder: 10, sansho: { shukun: 2, kanto: 2, gino: 1 } },
    ]);
    const hall = hallOfFame(g);
    expect(hall.map((a) => a.name)).toEqual(['元弟子2', '元弟子3', '元弟子1']);
    expect(fameReasons(hall[0]!)).toEqual(['Y']);
    expect(fameReasons(hall[1]!)).toEqual(['sansho']);
  });
});
