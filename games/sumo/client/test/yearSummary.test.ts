import { describe, expect, it } from 'vitest';
import { createGame } from '@ichimon/sim';
import ja from '../src/i18n/ja.json';
import en from '../src/i18n/en.json';
import { yearSummary } from '../src/yearSummary';
import { highlightsOf } from '../src/highlights';
import { autoStep } from '../../sim/test/play';

describe('1年のふりかえり', () => {
  it('その年の6場所の成績・収支・順位をまとめる', () => {
    let g = createGame({ seed: 12 });
    for (let i = 0; i < 6; i++) g = autoStep(g);
    const y = yearSummary(g, 5);
    expect(y.year).toBe(1);
    expect(y.appearances).toBeGreaterThan(0);
    expect(y.kachikoshi).toBeLessThanOrEqual(y.appearances);
    const log = g.moneyLog.filter((e) => e.bashoIndex <= 5);
    expect(y.net).toBe(log.reduce((s, e) => s + e.income - e.expenses, 0));
    expect(y.place?.to).toBe(log.at(-1)!.place);
  });

  it('九州場所の後だけ、見せ場の最後に出す', () => {
    let g = createGame({ seed: 12 });
    for (let i = 0; i < 6; i++) {
      const prev = g;
      g = autoStep(g);
      const hl = highlightsOf(g, g.lastReport!, prev);
      const year = hl.filter((h) => h.kind === 'year');
      if (g.lastReport!.bashoIndex % 6 === 5) {
        expect(year.length).toBe(1);
        expect(hl.at(-1)!.kind).toBe('year');
      } else expect(year.length).toBe(0);
    }
  });

  it('文言がある', () => {
    for (const k of ['year.title', 'year.record', 'year.events', 'year.standing']) {
      expect(ja).toHaveProperty([k]);
      expect(en).toHaveProperty([k]);
    }
  });
});
