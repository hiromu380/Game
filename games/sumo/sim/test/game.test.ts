import { describe, expect, it } from 'vitest';
import { advanceBasho, createGame, divisionCounts, ranksOf } from '../src';
import { play } from './play';

describe('ゲームの開始', () => {
  it('番付が段の定員どおりに埋まり、自分の部屋に弟子がいる', () => {
    const s = createGame({ seed: 1 });
    const counts = divisionCounts(s.banzuke.length);
    expect(counts.makuuchi).toBe(42);
    expect(counts.juryo).toBe(28);
    expect(counts.makushita).toBe(120);
    expect(counts.sandanme).toBe(180);
    const ranks = ranksOf(s.banzuke, s.titles);
    expect([...ranks.values()].filter((r) => r.title === 'Y')).toHaveLength(2);
    expect(s.rikishi.filter((r) => r.stableId === s.player.stableId).length).toBeGreaterThan(0);
  });

  it('同じシードなら同じ相撲界', () => {
    expect(JSON.stringify(createGame({ seed: 7 }))).toBe(JSON.stringify(createGame({ seed: 7 })));
  });
});

describe('場所を進める', () => {
  it('決定論: 同じ状態から同じ結果', () => {
    const s = createGame({ seed: 3 });
    expect(JSON.stringify(advanceBasho(s))).toBe(JSON.stringify(advanceBasho(s)));
  });

  it('入力の state を変えない', () => {
    const s = createGame({ seed: 3 });
    const before = JSON.stringify(s);
    advanceBasho(s);
    expect(JSON.stringify(s)).toBe(before);
  });

  it('関取は15番・幕下以下は7番（休場を含めて）', () => {
    const s = advanceBasho(createGame({ seed: 4 }));
    const r = s.rikishi;
    for (const x of r) {
      const rec = x.recent[0];
      if (!rec) continue;
      const total = rec.wins + rec.losses + rec.absences;
      const sekitori = rec.rank.division === 'makuuchi' || rec.rank.division === 'juryo';
      expect(total).toBeLessThanOrEqual(sekitori ? 15 : 7);
      // 一番下の段が奇数のとき、1日休みになる者がいる
      if (rec.absences === 0) expect(total).toBeGreaterThanOrEqual(sekitori ? 15 : 6);
    }
  });

  it('各段に優勝者がいて、幕内の地位（横綱・大関・関脇2・小結2以上）がそろう', () => {
    const s = advanceBasho(createGame({ seed: 5 }));
    expect(Object.keys(s.lastReport!.yusho)).toHaveLength(6);
    const titles = Object.values(s.titles);
    expect(titles.filter((t) => t === 'S').length).toBeGreaterThanOrEqual(2);
    expect(titles.filter((t) => t === 'K').length).toBeGreaterThanOrEqual(2);
  });

  it('5年進めても番付の人数が保たれ、壊れない', () => {
    const s = play(11, 30);
    expect(s.banzuke.length).toBeGreaterThan(560);
    expect(s.banzuke.length).toBeLessThan(700);
    expect(new Set(s.banzuke).size).toBe(s.banzuke.length);
    // 番付に載っていない力士は自分の部屋の新弟子だけ
    const on = new Set(s.banzuke);
    for (const r of s.rikishi) if (!on.has(r.id)) expect(r.stableId).toBe(s.player.stableId);
  });
});
