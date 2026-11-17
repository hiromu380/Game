import { describe, expect, it } from 'vitest';
import { createGame, type Rikishi } from '@ichimon/sim';
import ja from '../src/i18n/ja.json';
import en from '../src/i18n/en.json';
import { ACHIEVEMENTS, achievedOf, newlyAchieved } from '../src/achievements';
import { gradeOf, overallOf } from '../src/grade';
import { titlesOf } from '../src/titles';
import { autoStep } from '../../sim/test/play';

describe('実績', () => {
  it('40前後あり、id は重ならず、文言が日本語・英語にある', () => {
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(38);
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
    for (const a of ACHIEVEMENTS)
      for (const k of [`achv.${a.id}.name`, `achv.${a.id}.hint`, `achv.group.${a.group}`]) {
        expect(ja).toHaveProperty([k]);
        expect(en).toHaveProperty([k]);
      }
  });

  it('一度達成したら戻らず、新しい分だけ知らせる', () => {
    let g = createGame({ seed: 3 });
    let had = new Set(achievedOf(g));
    for (let i = 0; i < 24; i++) {
      const next = autoStep(g);
      const now = new Set(achievedOf(next));
      for (const id of had) expect(now.has(id)).toBe(true);
      expect(newlyAchieved(g, next)).toEqual([...now].filter((id) => !had.has(id)));
      g = next;
      had = now;
    }
    expect(had.has('firstDeshi')).toBe(true);
  });
});

describe('能力のランクと称号', () => {
  it('ランクは境目で切り替わる', () => {
    expect(gradeOf(85)).toBe('S');
    expect(gradeOf(84.9)).toBe('A');
    expect(gradeOf(65)).toBe('B');
    expect(gradeOf(0)).toBe('F');
  });

  it('総合力は得意な能力を重く見る', () => {
    expect(overallOf({ oshi: 80, yotsu: 40, waza: 40 })).toBe(60);
    expect(overallOf({ oshi: 60, yotsu: 60, waza: 60 })).toBe(60);
  });

  it('称号は記録から決まり、2つまで', () => {
    const g = createGame({ seed: 1 });
    const base = g.rikishi[0]!;
    const r: Rikishi = {
      ...base,
      weight: 190,
      abilities: { oshi: 80, yotsu: 50, waza: 50 },
      career: { ...base.career, makuuchiYusho: 2, kinboshi: 4 },
    };
    const ts = titlesOf(r, true);
    expect(ts.map((x) => x.id)).toEqual(['yusho', 'kinboshi']);
    expect(ts[0]!.n).toBe(2);
    const plain: Rikishi = { ...base, weight: 140, abilities: { oshi: 40, yotsu: 40, waza: 40 } };
    expect(
      titlesOf({ ...plain, career: { ...plain.career, basho: 0, absences: 0 } }, false),
    ).toEqual([]);
    for (const id of [
      'yusho',
      'kinboshi',
      'sansho',
      'tokui',
      'oshiMaster',
      'yotsuMaster',
      'wazaMaster',
      'ironman',
      'veteran',
      'rising',
      'giant',
      'small',
    ]) {
      expect(ja).toHaveProperty([`title.${id}`]);
      expect(en).toHaveProperty([`title.${id}`]);
    }
  });
});
