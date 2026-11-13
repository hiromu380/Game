import { describe, expect, it } from 'vitest';
import {
  advanceBasho,
  canPrep,
  createGame,
  doPrep,
  migrateSave,
  PREP,
  prepLeft,
  SAVE_VERSION,
  type GameState,
  type Rikishi,
} from '../src';

function start(seed = 5): { s: GameState; mine: Rikishi[] } {
  const s = createGame({ seed });
  const mine = s.rikishi.filter((r) => r.stableId === s.player.stableId);
  for (const r of mine) {
    r.injury = 0;
    r.policy = 'oshi';
  }
  return { s, mine };
}
const of = (s: GameState, id: number) => s.rikishi.find((r) => r.id === id)!;

describe('場所前の4週間', () => {
  it('はじめは4週残っていて、行動のたびに1週進む。4週で選べなくなる', () => {
    let { s } = start();
    expect(prepLeft(s)).toBe(PREP.weeks);
    for (let i = 0; i < PREP.weeks; i++) {
      expect(canPrep(s, { kind: 'usual' })).toBe(true);
      s = doPrep(s, { kind: 'usual' });
      expect(s.prep.week).toBe(i + 1);
      expect(s.prep.log).toHaveLength(i + 1);
    }
    expect(prepLeft(s)).toBe(0);
    expect(canPrep(s, { kind: 'rest' })).toBe(false);
    expect(doPrep(s, { kind: 'rest' })).toBe(s);
  });

  it('場所を進めると、はじめからになる', () => {
    let { s } = start();
    s = doPrep(s, { kind: 'rest' });
    s = advanceBasho(s);
    expect(s.prep).toEqual({ week: 0, log: [] });
  });

  it('個別指導: 選んだ弟子の、方針の能力だけが伸びて疲れる', () => {
    const { s, mine } = start();
    const r = mine[0]!;
    const next = doPrep(s, { kind: 'coach', id: r.id });
    const after = of(next, r.id);
    expect(after.abilities.oshi).toBeGreaterThan(r.abilities.oshi);
    expect(after.abilities.yotsu).toBe(r.abilities.yotsu);
    expect(after.fatigue).toBe(Math.min(100, r.fatigue + PREP.coach.fatigue));
    for (const other of mine.slice(1)) expect(of(next, other.id)).toEqual(other);
    const log = next.prep.log[0]!;
    expect(log.gains).toHaveLength(1);
    expect(log.gains[0]!.oshi).toBeGreaterThan(0);
    // 入力は変えない・同じ入力なら同じ結果
    expect(of(s, r.id).abilities.oshi).toBe(r.abilities.oshi);
    expect(doPrep(s, { kind: 'coach', id: r.id })).toEqual(next);
  });

  it('個別指導: けが人・休養の弟子・よその弟子には、つけられない', () => {
    const { s, mine } = start();
    mine[0]!.injury = 2;
    mine[1]!.policy = 'rest';
    const other = s.rikishi.find((r) => r.stableId !== s.player.stableId)!;
    expect(canPrep(s, { kind: 'coach', id: mine[0]!.id })).toBe(false);
    expect(canPrep(s, { kind: 'coach', id: mine[1]!.id })).toBe(false);
    expect(canPrep(s, { kind: 'coach', id: other.id })).toBe(false);
  });

  it('申し合い: 2人とも伸びて疲れる。格上と当たった方がよく伸びる', () => {
    const { s, mine } = start();
    const [a, b] = mine as [Rikishi, Rikishi];
    // 素質までの残りを同じにして、強さだけを変える
    a.talent = 80;
    b.talent = 80;
    a.abilities = { oshi: 30, yotsu: 30, waza: 30 };
    b.abilities = { oshi: 30, yotsu: 60, waza: 60 };
    a.age = b.age = 22;
    a.peakAge = b.peakAge = 28;
    const next = doPrep(s, { kind: 'spar', a: a.id, b: b.id });
    const ga = of(next, a.id).abilities.oshi - 30;
    const gb = of(next, b.id).abilities.oshi - 30;
    expect(ga).toBeGreaterThan(0);
    expect(gb).toBeGreaterThan(0);
    expect(ga).toBeGreaterThan(gb);
    expect(of(next, a.id).fatigue).toBe(Math.min(100, a.fatigue + PREP.spar.fatigue));
    expect(canPrep(s, { kind: 'spar', a: a.id, b: a.id })).toBe(false);
  });

  it('申し合いのけがは、ときどき起きる（起きたら休場になり、部位が付く）', () => {
    let hurt = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const { s, mine } = start(seed);
      const next = doPrep(s, { kind: 'spar', a: mine[0]!.id, b: mine[1]!.id });
      for (const id of next.prep.log[0]!.injured) {
        hurt++;
        expect(of(next, id).injury).toBeGreaterThan(0);
        expect(of(next, id).wound).toBeDefined();
      }
    }
    expect(hurt).toBeGreaterThan(0);
    expect(hurt).toBeLessThan(30);
  });

  it('胸を借りる: 個別指導より大きく伸び、お金と疲れがかかる。けがはときどき（申し合いより多い）', () => {
    const { s, mine } = start();
    const r = mine[0]!;
    const coach =
      of(doPrep(s, { kind: 'coach', id: r.id }), r.id).abilities.oshi - r.abilities.oshi;
    const out = doPrep(s, { kind: 'mune', id: r.id });
    const gain = of(out, r.id).abilities.oshi - r.abilities.oshi;
    expect(gain).toBeGreaterThan(coach);
    expect(out.player.stableMoney).toBe(s.player.stableMoney - PREP.mune.cost);
    expect(of(out, r.id).fatigue).toBe(Math.min(100, r.fatigue + PREP.mune.fatigue));
    const poor = { ...s, player: { ...s.player, stableMoney: 0 } };
    expect(canPrep(poor, { kind: 'mune', id: r.id })).toBe(false);
    let hurt = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const x = start(seed);
      const next = doPrep(x.s, { kind: 'mune', id: x.mine[0]!.id });
      hurt += next.prep.log[0]!.injured.length;
    }
    expect(hurt).toBeGreaterThan(2);
    expect(hurt).toBeLessThan(40);
  });

  it('出稽古はお金がかかり、けがのない全員が伸びる。休ませると全員の疲れが抜ける', () => {
    const { s, mine } = start();
    mine[0]!.injury = 1;
    for (const r of mine) r.fatigue = 50;
    const out = doPrep(s, { kind: 'degeiko' });
    expect(out.player.stableMoney).toBe(s.player.stableMoney - PREP.degeiko.cost);
    expect(out.prep.log[0]!.gains.map((g) => g.id)).toEqual(mine.slice(1).map((r) => r.id));
    expect(of(out, mine[1]!.id).fatigue).toBe(50 + PREP.degeiko.fatigue);
    const rest = doPrep(s, { kind: 'rest' });
    for (const r of mine) expect(of(rest, r.id).fatigue).toBe(50 + PREP.rest.fatigue);
    const poor = { ...s, player: { ...s.player, stableMoney: 0 } };
    expect(canPrep(poor, { kind: 'degeiko' })).toBe(false);
  });

  it('挨拶回りとスカウト回りも、1週を使う', () => {
    const { s } = start();
    const p = s.player.koenkai.patrons[0];
    if (p) {
      const next = doPrep(s, { kind: 'visit', patronId: p.id });
      expect(next.prep.week).toBe(1);
      expect(next.player.koenkai.patrons[0]!.favor).toBeGreaterThanOrEqual(p.favor);
      // 同じ場所に同じ人へは2回行けない
      expect(canPrep(next, { kind: 'visit', patronId: p.id })).toBe(false);
    }
    const scouted = doPrep(s, { kind: 'scout', trip: 'countryside' });
    expect(scouted.prep.week).toBe(1);
    expect(scouted.prep.log[0]!.met).toBeGreaterThanOrEqual(0);
    expect(canPrep(scouted, { kind: 'scout', trip: 'countryside' })).toBe(false);
  });

  it('古いセーブ（版17）は、4週残った状態で読める', () => {
    const { s } = start();
    const old = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
    delete old.prep;
    old.version = 17;
    const loaded = migrateSave(old)!;
    expect(loaded.version).toBe(SAVE_VERSION);
    expect(loaded.prep).toEqual({ week: 0, log: [] });
  });
});
