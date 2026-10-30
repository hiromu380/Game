import { describe, expect, it } from 'vitest';
import {
  advanceBasho,
  createGame,
  hireStaff,
  migrateSave,
  setDiet,
  staffCandidates,
  type Alumnus,
  type GameState,
  type Rank,
} from '../src';

const JURYO: Rank = { division: 'juryo', title: null, number: 5, side: 'E' };
const JONIDAN: Rank = { division: 'jonidan', title: null, number: 50, side: 'E' };

function withAlumnus(s: GameState, patch: Partial<Alumnus> & { highest?: Rank; basho?: number }) {
  const base = s.rikishi.find((r) => r.stableId === s.player.stableId)!;
  const a: Alumnus = {
    id: s.nextId++,
    name: patch.name ?? '白岩',
    retiredAge: patch.retiredAge ?? 32,
    retiredBashoIndex: s.bashoIndex,
    generation: 1,
    becameOyakata: patch.becameOyakata ?? false,
    foreign: false,
    career: {
      ...JSON.parse(JSON.stringify(base.career)),
      highestRank: patch.highest ?? JURYO,
      basho: patch.basho ?? 60,
    },
    track: [],
  };
  s.player.alumni.push(a);
  return a;
}

describe('部屋の人（若者頭・世話人）', () => {
  it('雇えるのは親方にならなかった元十両・幕下などで、現役が長かった元弟子だけ', () => {
    const s = createGame({ seed: 1 });
    const ok = withAlumnus(s, {});
    withAlumnus(s, { name: '白川', highest: JONIDAN });
    withAlumnus(s, { name: '白波', basho: 10 });
    withAlumnus(s, { name: '白峰', becameOyakata: true });
    expect(staffCandidates(s, 'wakaimonogashira').map((a) => a.id)).toEqual([ok.id]);
  });

  it('雇うと日誌に残り、同じ役に別の人を雇うと前の人は辞める', () => {
    const s = createGame({ seed: 1 });
    const a = withAlumnus(s, {});
    const b = withAlumnus(s, { name: '白川' });
    const one = hireStaff(s, 'sewanin', a.id);
    expect(one.player.staff).toMatchObject([{ role: 'sewanin', name: '白岩', skill: 2 }]);
    expect(one.journal.at(-1)).toMatchObject({ kind: 'staffHire', role: 'sewanin' });
    const two = hireStaff(one, 'sewanin', b.id);
    expect(two.player.staff.map((x) => x.name)).toEqual(['白川']);
    expect(two.journal.slice(-2).map((e) => e.kind)).toEqual(['staffLeave', 'staffHire']);
    // 同じ人を2つの役には雇えない
    expect(hireStaff(two, 'wakaimonogashira', b.id)).toBe(two);
  });

  it('若者頭がいると、幕下以下の弟子の稽古がよく伸びる（同じシードで比べる）', () => {
    const s = createGame({ seed: 5 });
    const a = withAlumnus(s, {});
    const sum = (g: GameState) =>
      g.rikishi
        .filter((r) => r.stableId === g.player.stableId)
        .reduce((n, r) => n + r.abilities.oshi + r.abilities.yotsu + r.abilities.waza, 0);
    const without = advanceBasho(s);
    const withW = advanceBasho(hireStaff(s, 'wakaimonogashira', a.id));
    expect(sum(withW)).toBeGreaterThan(sum(without));
  });

  it('定年（65歳）で協会を去る', () => {
    const s = createGame({ seed: 1 });
    const a = withAlumnus(s, { retiredAge: 64 });
    let g = hireStaff(s, 'sewanin', a.id);
    for (let i = 0; i < 6; i++) g = advanceBasho(g);
    expect(g.player.staff).toHaveLength(0);
    expect(g.journal.some((e) => e.kind === 'staffLeave' && e.retired)).toBe(true);
  });
});

describe('ちゃんこの方針', () => {
  it('節約は食費が減り、大盛りは食費が増えて体が大きくなる', () => {
    const s = createGame({ seed: 2 });
    const food = (g: GameState) => g.lastReport!.expenses.find((l) => l.key === 'food')!.amount;
    const weight = (g: GameState) =>
      g.rikishi.filter((r) => r.stableId === g.player.stableId).reduce((n, r) => n + r.weight, 0);
    const base = advanceBasho(s);
    const frugal = advanceBasho(setDiet(s, 'frugal'));
    const hearty = advanceBasho(setDiet(s, 'hearty'));
    expect(food(frugal)).toBeLessThan(food(base));
    expect(food(hearty)).toBeGreaterThan(food(base));
    expect(weight(hearty)).toBeGreaterThan(weight(base));
    expect(setDiet(s, 'hearty').journal.at(-1)).toMatchObject({ kind: 'diet', diet: 'hearty' });
  });

  it('版11のセーブは、方針ふつう・部屋の人なしで読む', () => {
    const v11 = JSON.parse(JSON.stringify(createGame({ seed: 1 })));
    v11.version = 11;
    delete v11.player.diet;
    delete v11.player.staff;
    const m = migrateSave(v11)!;
    expect(m.version).toBe(15);
    expect(m.player.diet).toBe('standard');
    expect(m.player.staff).toEqual([]);
  });
});
