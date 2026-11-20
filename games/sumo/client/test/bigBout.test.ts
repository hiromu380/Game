import { describe, expect, it } from 'vitest';
import { bigBouts, highlightsOf } from '../src/highlights';
import { autoStep, play } from '../../sim/test/play';

describe('勝ち越しをかけた大一番', () => {
  it('7勝7敗・3勝3敗で最後の番を迎えた弟子だけ', () => {
    let found = 0;
    for (const seed of [1, 2, 3]) {
      let g = play(seed, 0);
      for (let i = 0; i < 12; i++) {
        g = autoStep(g);
        const report = g.lastReport;
        if (!report) continue;
        for (const h of bigBouts(report)) {
          found++;
          const m = report.mine.find((x) => x.id === h.id)!;
          expect(h.wins).toBe(h.losses);
          expect([3, 7]).toContain(h.wins);
          const won = h.bout.winnerId === h.id;
          expect(m.record.wins).toBe(h.wins + (won ? 1 : 0));
          expect(m.record.losses).toBe(h.losses + (won ? 0 : 1));
        }
        // 見せ場では、結果を知る前（最初）に出す
        const hl = highlightsOf(g, report);
        if (bigBouts(report).length > 0) expect(hl[0]!.kind).toBe('bigBout');
        expect(hl.filter((h) => h.kind === 'bigBout').length).toBeLessThanOrEqual(2);
      }
    }
    expect(found).toBeGreaterThan(0);
  });
});
