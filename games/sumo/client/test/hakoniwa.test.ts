import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '@ichimon/sim';
import { depthOrder, frontCorner, overlaps, toScreen } from '../src/art/hakoniwa/grid';
import {
  compoundPieces,
  GATE,
  NOBORI_MAX,
  PATH,
  PLOT,
  seasonOf,
} from '../src/art/hakoniwa/compound';

function game(facilities: Partial<GameState['player']['facilities']>, bashoIndex = 0): GameState {
  const g = createGame({ seed: 4 });
  g.player.facilities = { ...g.player.facilities, ...facilities };
  g.bashoIndex = bashoIndex;
  return g;
}

describe('箱庭のマス目', () => {
  it('マス (0,0) の上の角が原点。右下へ gx、左下へ gy', () => {
    expect(toScreen(0, 0)).toEqual({ x: 0, y: 0 });
    expect(toScreen(1, 0)).toEqual({ x: 16, y: 8 });
    expect(toScreen(0, 1)).toEqual({ x: -16, y: 8 });
    expect(frontCorner({ gx: 1, gy: 1, w: 2, d: 1 })).toEqual(toScreen(3, 2));
  });

  it('奥の物から手前の物の順に描く', () => {
    const a = { gx: 0, gy: 0, w: 1, d: 1 };
    const b = { gx: 5, gy: 5, w: 1, d: 1 };
    expect(depthOrder([b, a])).toEqual([a, b]);
  });
});

describe('部屋の敷地（外観）', () => {
  it('建物と庭の物は敷地の中で、足元が重ならない（門は塀の上）', () => {
    for (const f of [
      { dorm: 0, trainer: 1 },
      { dorm: 1, trainer: 0 },
      { dorm: 2, trainer: 2 },
    ]) {
      const pieces = compoundPieces(game(f));
      for (const p of pieces) {
        expect(p.gx).toBeGreaterThanOrEqual(0);
        expect(p.gy).toBeGreaterThanOrEqual(0);
        expect(p.gx + p.w).toBeLessThanOrEqual(PLOT.w);
        expect(p.gy + p.d).toBeLessThanOrEqual(PLOT.d);
      }
      for (let i = 0; i < pieces.length; i++)
        for (let j = i + 1; j < pieces.length; j++)
          expect(
            overlaps(pieces[i]!, pieces[j]!),
            `${pieces[i]!.sprite} と ${pieces[j]!.sprite}`,
          ).toBe(false);
    }
  });

  it('敷石は門から母屋の玄関まで。建物の下を通らない', () => {
    const pieces = compoundPieces(game({ trainer: 1 }));
    const gate = pieces.find((p) => p.sprite === 'gate')!;
    expect(gate.gx).toBe(GATE.gx);
    for (const [x, y] of PATH) {
      const tile = { sprite: '', gx: x, gy: y, w: 1, d: 1 };
      for (const p of pieces.filter((q) => q.sprite !== 'gate'))
        expect(overlaps(tile, p)).toBe(false);
    }
  });

  it('寮は増築の段で、治療院はトレーナー契約で、季節の木は場所の季節で変わる', () => {
    const sprites = (g: GameState) => compoundPieces(g).map((p) => p.sprite);
    expect(sprites(game({ dorm: 0 }))).toContain('dorm_0');
    expect(sprites(game({ dorm: 2 }))).toContain('dorm_2');
    expect(sprites(game({ trainer: 0 }))).not.toContain('clinic');
    expect(sprites(game({ trainer: 1 }))).toContain('clinic');
    expect([0, 1, 2, 3, 4, 5].map(seasonOf)).toEqual([
      'winter',
      'spring',
      'summer',
      'summer',
      'autumn',
      'autumn',
    ]);
    expect(sprites(game({}, 7))).toContain('tree_season__spring');
  });

  it('自分の部屋の関取の幟を、番付の上から3本まで前庭に立てる', () => {
    const g = createGame({ seed: 4 });
    expect(compoundPieces(g).filter((p) => p.sprite === 'nobori')).toHaveLength(0);
    const top = g.banzuke.slice(0, 4);
    for (const r of g.rikishi) if (top.includes(r.id)) r.stableId = g.player.stableId;
    const nobori = compoundPieces(g).filter((p) => p.sprite === 'nobori');
    expect(nobori).toHaveLength(NOBORI_MAX);
    const name = (id: number) => g.rikishi.find((r) => r.id === id)!.name;
    expect(nobori.map((p) => p.label)).toEqual(top.slice(0, 3).map(name));
    for (const p of nobori) expect(p.gy + p.d).toBeLessThanOrEqual(PLOT.d);
  });
});
