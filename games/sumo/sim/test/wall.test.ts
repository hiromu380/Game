import { describe, expect, it } from 'vitest';
import {
  atWall,
  breakWall,
  createGame,
  doPrep,
  focusOf,
  traitsOf,
  WALL,
  type GameState,
  type Rikishi,
} from '../src';

function start(seed = 5): { s: GameState; r: Rikishi } {
  const s = createGame({ seed });
  const r = s.rikishi.find((x) => x.stableId === s.player.stableId)!;
  r.injury = 0;
  r.policy = 'oshi';
  r.age = 22;
  r.peakAge = 28;
  r.talent = 60;
  r.breakthrough = 0;
  r.abilities = { oshi: 59, yotsu: 30, waza: 30 };
  return { s, r };
}
const of = (s: GameState, id: number) => s.rikishi.find((r) => r.id === id)!;

describe('素質の壁', () => {
  it('方針の能力が素質の近くまで来ると壁に当たる。けが・休養・ピーク過ぎは当たらない', () => {
    const { r } = start();
    expect(focusOf(r)).toBe('oshi');
    expect(atWall(r)).toBe(true);
    expect(atWall({ ...r, abilities: { ...r.abilities, oshi: 60 - WALL.margin - 1 } })).toBe(false);
    expect(atWall({ ...r, injury: 1 })).toBe(false);
    expect(atWall({ ...r, policy: 'rest' })).toBe(false);
    expect(atWall({ ...r, age: 29 })).toBe(false);
    // 体づくりは一番高い能力で見る
    expect(focusOf({ ...r, policy: 'body' })).toBe('oshi');
  });

  it('壁を破ると素質が上がる。上がるほど上がりにくく、合計は上限まで', () => {
    const { r } = start();
    const first = breakWall(r, 2);
    expect(first).toBe(2);
    expect(r.talent).toBe(62);
    expect(r.breakthrough).toBe(2);
    // 素質が上がったので、能力が追いつくまで壁ではない
    expect(breakWall(r, 2)).toBe(0);
    let last = first;
    for (let i = 0; i < 200; i++) {
      r.abilities.oshi = r.talent;
      const inc = breakWall(r, 2);
      if (inc === 0) break;
      expect(inc).toBeLessThanOrEqual(last);
      last = inc;
    }
    expect(r.breakthrough).toBeLessThanOrEqual(WALL.maxBonus);
    expect(r.talent).toBeLessThanOrEqual(60 + WALL.maxBonus);
  });

  it('壁を破っても性格（素質で決まる特徴）は変わらない', () => {
    const { r } = start();
    const before = traitsOf(r);
    for (let i = 0; i < 10; i++) {
      r.abilities.oshi = r.talent;
      breakWall(r, 2.5);
    }
    expect(r.breakthrough).toBeGreaterThan(5);
    expect(traitsOf(r)).toEqual(before);
  });

  it('壁に当たった弟子に胸を借りさせると、個別指導より大きく素質が上がり、記録に残る', () => {
    const { s, r } = start();
    const coach = doPrep(s, { kind: 'coach', id: r.id });
    const mune = doPrep(s, { kind: 'mune', id: r.id });
    const up = (x: GameState) => of(x, r.id).talent - r.talent;
    expect(up(coach)).toBeGreaterThan(0);
    expect(up(mune)).toBeGreaterThan(up(coach));
    expect(mune.prep.log[0]!.walls).toEqual([{ id: r.id, inc: up(mune) }]);
    // 同じ入力なら同じ結果
    expect(doPrep(s, { kind: 'mune', id: r.id })).toEqual(mune);
  });

  it('壁に当たっていなければ、素質は動かない', () => {
    const { s, r } = start();
    r.abilities.oshi = 40;
    const next = doPrep(s, { kind: 'mune', id: r.id });
    expect(of(next, r.id).talent).toBe(60);
    expect(next.prep.log[0]!.walls).toBeUndefined();
  });
});
