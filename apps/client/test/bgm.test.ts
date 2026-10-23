import { describe, expect, it } from 'vitest';
import { barSeconds, BGM_RECIPES, bgmBarNotes } from '../src/audio/bgm';

describe('BGM のレシピ', () => {
  it('同じ小節からは同じ音の並び（乱数を使わない）。和音の数で一周する', () => {
    const r = BGM_RECIPES.building;
    expect(bgmBarNotes(r, 3)).toEqual(bgmBarNotes(r, 3));
    expect(bgmBarNotes(r, 3 + r.chords.length)).toEqual(bgmBarNotes(r, 3));
  });

  it('どの曲のどの小節も、音は小節の中に収まり、音量は控えめ', () => {
    for (const recipe of Object.values(BGM_RECIPES)) {
      const bar = barSeconds(recipe);
      for (let i = 0; i < recipe.chords.length; i++) {
        const notes = bgmBarNotes(recipe, i);
        expect(notes.length).toBeGreaterThan(0);
        for (const n of notes) {
          expect(n.at).toBeGreaterThanOrEqual(0);
          expect(n.at).toBeLessThan(bar);
          expect(n.volume).toBeLessThanOrEqual(0.15);
          expect(n.freq).toBeGreaterThan(20);
        }
      }
    }
  });

  it('夜の曲は組み立ての曲より速い', () => {
    expect(BGM_RECIPES.night.bpm).toBeGreaterThan(BGM_RECIPES.building.bpm);
  });
});
