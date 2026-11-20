import { describe, expect, it } from 'vitest';
import { stableStandings, stableStrength } from '../src';
import { play } from './play';

describe('部屋の力の番付', () => {
  it('すべての部屋を力の大きい順に並べ、力は stableStrength と同じ', () => {
    const g = play(6, 6);
    const rows = stableStandings(g);
    expect(rows.length).toBe(g.stables.length);
    for (let i = 1; i < rows.length; i++)
      expect(rows[i - 1]!.strength).toBeGreaterThanOrEqual(rows[i]!.strength);
    for (const r of rows.slice(0, 5)) expect(r.strength).toBe(stableStrength(g, r.stableId));
  });

  it('同じ力は同じ順位', () => {
    const rows = stableStandings(play(2, 3));
    for (let i = 1; i < rows.length; i++)
      if (rows[i]!.strength === rows[i - 1]!.strength)
        expect(rows[i]!.place).toBe(rows[i - 1]!.place);
      else expect(rows[i]!.place).toBe(i + 1);
  });
});
