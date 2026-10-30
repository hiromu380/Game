import { describe, expect, it } from 'vitest';
import { createGame, KOJO_WORDS, type BashoReport, type GameState } from '@ichimon/sim';
import { highlightsOf, kojoChoices } from '../src/highlights';

function report(s: GameState, patch: Partial<BashoReport>): BashoReport {
  return {
    bashoIndex: 0,
    yusho: {},
    mine: [],
    promotions: [],
    retired: [],
    injuries: [],
    banzukeChanges: [],
    jungyo: null,
    sansho: { shukun: [], kanto: [], gino: [] },
    playoff: null,
    income: [],
    expenses: [],
    personal: [],
    ...patch,
  };
}

describe('場所の見せ場', () => {
  const s = createGame({ seed: 3 });
  const [a, b] = s.rikishi.filter((r) => r.stableId === s.player.stableId);
  const other = s.rikishi.find((r) => r.stableId !== s.player.stableId)!;

  it('自分の部屋だけ。横綱・大関昇進 → 幕内優勝 → 新入幕・新十両 → ほかの段の優勝 → 三賞の順', () => {
    const hl = highlightsOf(
      s,
      report(s, {
        promotions: [
          { id: b!.id, to: 'sekitori' },
          { id: other.id, to: 'Y' },
          { id: a!.id, to: 'O' },
        ],
        yusho: { makuuchi: a!.id, juryo: other.id, jonidan: b!.id },
        sansho: { shukun: [a!.id], kanto: [a!.id], gino: [other.id] },
      }),
    );
    expect(hl.map((h) => h.kind + (h.kind === 'promotion' ? h.to : ''))).toEqual([
      'promotionO',
      'yusho',
      'promotionsekitori',
      'yusho',
      'sansho',
    ]);
    expect(hl[4]).toEqual({ kind: 'sansho', id: a!.id, prizes: ['shukun', 'kanto'] });
  });

  it('何もなければ空', () => {
    expect(highlightsOf(s, report(s, {}))).toEqual([]);
  });

  it('元弟子の断髪式は最後に見せる', () => {
    const s = createGame({ seed: 1 });
    const a = s.rikishi.find((r) => r.stableId === s.player.stableId)!;
    const d = { alumnusId: 5, venue: 'hotel' as const, hasami: 50, patrons: [], rival: null };
    const hl = highlightsOf(
      s,
      report(s, { danpatsu: [d], sansho: { shukun: [a.id], kanto: [], gino: [] } }),
    );
    expect(hl.map((h) => h.kind)).toEqual(['sansho', 'danpatsu']);
  });

  it('口上の候補は力士ごとに決まった3つで、重ならない', () => {
    for (let id = 1; id < 40; id++) {
      const c = kojoChoices(id);
      expect(new Set(c).size).toBe(3);
      for (const w of c) expect(KOJO_WORDS).toContain(w);
      expect(kojoChoices(id)).toEqual(c);
    }
  });
});
