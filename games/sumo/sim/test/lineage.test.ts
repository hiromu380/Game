import { describe, expect, it } from 'vitest';
import {
  advanceBasho,
  answerIndependence,
  chooseTakeOver,
  createGame,
  migrateSave,
  type GameState,
  type Oyakata,
} from '../src';
import { play } from './play';

const M1 = { division: 'makuuchi' as const, title: 'M' as const, number: 1, side: 'E' as const };

/** 部屋付きの親方を1人足す（系譜図の節も） */
function withCoach(s: GameState, patch: Partial<Oyakata> = {}): Oyakata {
  const o: Oyakata = {
    id: s.nextId++,
    name: '白浦',
    shikona: '白山',
    age: 40,
    stableId: s.player.stableId,
    role: 'heyatsuki',
    style: 'oshi',
    highestRank: M1,
    generation: null,
    fromRikishiId: null,
    waitingSince: null,
    since: 0,
    ...patch,
  };
  s.oyakata.push(o);
  s.player.family.push({
    id: s.nextId++,
    name: o.name,
    shikona: o.shikona,
    parentId: s.player.family[0]!.id,
    stableId: o.stableId,
    kind: 'heyatsuki',
    oyakataId: o.id,
    fromBashoIndex: 0,
    toBashoIndex: null,
    highestRank: M1,
    sekitori: 0,
    sanyaku: 0,
    yokozuna: 0,
    makuuchiYusho: 0,
  });
  return o;
}

describe('系譜図', () => {
  it('開始時は初代の親方の節が1つ', () => {
    const s = createGame({ seed: 1 });
    expect(s.player.family).toHaveLength(1);
    expect(s.player.family[0]).toMatchObject({
      kind: 'master',
      parentId: null,
      oyakataId: s.player.oyakataId,
    });
  });
});

describe('分家（独立）', () => {
  const requested = () => {
    const s = createGame({ seed: 12 });
    const o = withCoach(s);
    s.pending.independence = o.id;
    return { s, o };
  };

  it('認めると新しい部屋が開き、選んだ内弟子が移る。系譜図の節は分家の師匠になる', () => {
    const { s, o } = requested();
    const take = s.rikishi
      .filter((r) => r.stableId === s.player.stableId)
      .slice(0, 2)
      .map((r) => r.id);
    const next = answerIndependence(s, true, take);
    const branch = next.stables.find((x) => x.branch)!;
    expect(branch.name).toBe(o.name);
    expect(next.rikishi.filter((r) => r.stableId === branch.id).map((r) => r.id)).toEqual(take);
    expect(next.oyakata.some((x) => x.id === o.id)).toBe(false);
    const node = next.player.family.find((n) => n.id === branch.branch!.nodeId)!;
    expect(node).toMatchObject({
      kind: 'branch',
      parentId: s.player.family[0]!.id,
      shikona: o.shikona,
    });
  });

  it('引き留めると部屋付きのまま残る（返事をしないまま進めても同じ）', () => {
    const { s, o } = requested();
    expect(answerIndependence(s, false).oyakata.some((x) => x.id === o.id)).toBe(true);
    const advanced = advanceBasho(s);
    expect(advanced.pending.independence).toBeNull();
    expect(advanced.oyakata.some((x) => x.id === o.id)).toBe(true);
  });

  it('本家の跡継ぎがいなくても、分家があれば分家を継いで続けられる', () => {
    const { s } = requested();
    const opened = answerIndependence(s, true, []);
    const branchId = opened.stables.find((x) => x.branch)!.id;
    opened.bashoIndex = 5;
    opened.oyakata.find((o) => o.id === opened.player.oyakataId)!.age = 64;
    const atRetire = advanceBasho(opened);
    expect(atRetire.gameOver).toBeNull();
    expect(atRetire.pending.takeOver).toEqual([branchId]);
    const next = chooseTakeOver(atRetire, branchId);
    expect(next.player.stableId).toBe(branchId);
    expect(next.player.generation).toBe(2);
    expect(next.stables.find((x) => x.id === branchId)!.isPlayer).toBe(true);
    // 本家の弟子は分家へ移り、本家の部屋はなくなる
    expect(next.stables.some((x) => x.id === s.player.stableId)).toBe(false);
    expect(next.rikishi.some((r) => r.stableId === s.player.stableId)).toBe(false);
    expect(next.pending.kakun).not.toBeNull();
  });
});

describe('セーブの変換', () => {
  it('版1のセーブを今の版に変換できる（系譜図を親方から作る・設備は0）', () => {
    const s = createGame({ seed: 3 }) as unknown as Record<string, unknown> & {
      player: Record<string, unknown>;
    };
    const v1 = JSON.parse(JSON.stringify(s));
    v1.version = 1;
    delete v1.player.family;
    delete v1.pending.independence;
    delete v1.pending.takeOver;
    for (const st of v1.stables) delete st.branch;
    for (const o of v1.oyakata) delete o.since;
    const m = migrateSave(v1)!;
    expect(m.version).toBe(6);
    expect(m.player.facilities).toEqual({ dorm: 0, dojo: 0, trainer: 0, scout: 0 });
    expect(m.player.family).toHaveLength(1);
    expect(m.stables.every((x) => x.branch === null)).toBe(true);
    expect(advanceBasho(m).bashoIndex).toBe(1);
  });

  it('知らない形・未来の版は読まない', () => {
    expect(migrateSave(null)).toBeNull();
    expect(migrateSave({ version: 99 })).toBeNull();
  });
});

describe('長く遊ぶ', () => {
  it('30年進めても壊れず、系譜図の親子がつながっている', () => {
    const s = play(21, 180);
    const ids = new Set(s.player.family.map((n) => n.id));
    for (const n of s.player.family)
      if (n.parentId !== null) expect(ids.has(n.parentId)).toBe(true);
    for (const r of s.rikishi) expect(s.stables.some((x) => x.id === r.stableId)).toBe(true);
  }, 60_000);
});
