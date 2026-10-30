import { describe, expect, it } from 'vitest';
import { advanceBasho, createGame, ensureRival, migrateSave, type Candidate } from '../src';
import { autoStep } from './play';

describe('ライバルの部屋', () => {
  it('同期（師匠の年が近い）で、別の一門の部屋が選ばれる', () => {
    const s = createGame({ seed: 2 });
    const me = s.stables.find((x) => x.isPlayer)!;
    const rival = s.stables.find((x) => x.id === s.rival!.stableId)!;
    expect(rival.ichimonId).not.toBe(me.ichimonId);
    expect(rival.isPlayer).toBe(false);
    expect(s.rival).toMatchObject({ wins: 0, losses: 0, since: 0 });
  });

  it('場所ごとに直接対決を数え、通算に足す', () => {
    let s = createGame({ seed: 5 });
    let expected = 0;
    for (let i = 0; i < 12; i++) {
      s = autoStep(s);
      const r = s.lastReport!.rival!;
      expect(r.stableId).toBe(s.rival!.stableId);
      expected += r.wins + r.losses;
    }
    expect(s.rival!.wins + s.rival!.losses).toBe(expected);
    expect(s.lastReport!.rival!.sekitori).toHaveLength(2);
  });

  it('取り合いの新弟子に返事をしないと、ライバルの部屋に入る', () => {
    const s = createGame({ seed: 3 });
    const base = s.rikishi.find((r) => r.stableId === s.player.stableId)!;
    const c: Candidate = {
      id: s.nextId++,
      name: '大物',
      age: 15,
      height: 185,
      weight: 120,
      foreign: false,
      abilities: { ...base.abilities },
      talent: 85,
      peakAge: 27,
      fragility: 0.3,
      scoutGrade: 5,
      background: 'juniorHigh',
      contested: true,
    };
    s.pending.candidates = [c];
    const next = advanceBasho(s);
    const signed = next.rikishi.find((r) => r.name === '大物')!;
    expect(signed.stableId).toBe(s.rival!.stableId);
    expect(next.journal.some((e) => e.kind === 'rival' && e.event === 'signed')).toBe(true);
  });

  it('ライバルの部屋がなくなったら、新しいライバルを選ぶ', () => {
    const s = createGame({ seed: 4 });
    const old = s.rival!.stableId;
    s.stables = s.stables.filter((x) => x.id !== old);
    ensureRival(s);
    expect(s.rival!.stableId).not.toBe(old);
    expect(s.rival!.wins).toBe(0);
  });

  it('版12のセーブは、ライバルを選んで読む', () => {
    const v12 = JSON.parse(JSON.stringify(createGame({ seed: 1 })));
    v12.version = 12;
    delete v12.rival;
    const m = migrateSave(v12)!;
    expect(m.version).toBe(13);
    expect(m.rival).not.toBeNull();
  });
});
