import { describe, expect, it } from 'vitest';
import { doPrep, type PrepAction } from '@ichimon/sim';
import { bandOf, CUT_ROWS, gradeUp, weekEffect } from '../src/weekEffect';
import { play } from '../../sim/test/play';

const mine = (g: ReturnType<typeof play>) =>
  g.rikishi.filter((r) => r.stableId === g.player.stableId && r.injury === 0);

describe('週の稽古の効果', () => {
  it('前と後: 後は今の能力、前は伸びを引いたもの。選んだ人の順に出す', () => {
    const g0 = play(7, 4);
    const [a, b] = mine(g0);
    const act: PrepAction = { kind: 'spar', a: b!.id, b: a!.id };
    const g1 = doPrep(g0, act);
    const w = g1.prep.log.at(-1)!;
    const rows = weekEffect(g1, w);
    expect(rows.map((r) => r.id)).toEqual([b!.id, a!.id]);
    for (const row of rows) {
      const before = g0.rikishi.find((r) => r.id === row.id)!;
      for (const m of row.stats) expect(m.before).toBeCloseTo(before.abilities[m.key], 6);
    }
  });

  it('出稽古のように大勢が動く週は、よく伸びた順に上限まで', () => {
    const g0 = play(7, 4);
    const g1 = doPrep(g0, { kind: 'rest' });
    const rows = weekEffect(g1, g1.prep.log.at(-1)!);
    expect(rows.length).toBeLessThanOrEqual(CUT_ROWS);
    for (let i = 1; i < rows.length; i++) {
      const d = (x: (typeof rows)[number]) => x.fatigue.before - x.fatigue.after;
      expect(d(rows[i - 1]!)).toBeGreaterThanOrEqual(d(rows[i]!));
    }
  });

  it('ランクの中の位置と、ランクが上がったか', () => {
    expect(bandOf(55)).toEqual({ grade: 'C', pos: 0 });
    expect(bandOf(60).pos).toBeCloseTo(0.5);
    expect(bandOf(100)).toEqual({ grade: 'S', pos: 1 });
    expect(bandOf(10).grade).toBe('F');
    const row = {
      id: 1,
      name: 'x',
      stats: [
        {
          key: 'oshi' as const,
          before: 64.8,
          after: 65.2,
          gradeBefore: 'C' as const,
          gradeAfter: 'B' as const,
        },
      ],
      fatigue: { before: 0, after: 0 },
      weight: 0,
      wall: false,
      hurt: false,
    };
    expect(gradeUp(row)?.key).toBe('oshi');
    expect(gradeUp({ ...row, stats: [{ ...row.stats[0]!, gradeAfter: 'C' }] })).toBeNull();
  });
});

describe('場所前の積み上げ', () => {
  it('4週の伸びを弟子ごとに足し、伸びた順に並べる', async () => {
    const { prepTotals } = await import('../src/weekEffect');
    let g = play(7, 4);
    const [a, b] = mine(g);
    const start = new Map(g.rikishi.map((r) => [r.id, { ...r.abilities }]));
    g = doPrep(g, { kind: 'coach', id: a!.id });
    g = doPrep(g, { kind: 'coach', id: a!.id });
    g = doPrep(g, { kind: 'spar', a: a!.id, b: b!.id });
    const totals = prepTotals(g);
    for (let i = 1; i < totals.length; i++)
      expect(totals[i - 1]!.gain).toBeGreaterThanOrEqual(totals[i]!.gain);
    const ta = totals.find((x) => x.id === a!.id)!;
    const r = g.rikishi.find((x) => x.id === a!.id)!;
    const s0 = start.get(a!.id)!;
    expect(ta.gain).toBeCloseTo(
      r.abilities.oshi + r.abilities.yotsu + r.abilities.waza - s0.oshi - s0.yotsu - s0.waza,
      6,
    );
    if (ta.best) expect(ta.best.before).toBeCloseTo(s0[ta.best.key], 6);
  });
});
