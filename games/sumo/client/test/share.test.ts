import { describe, expect, it } from 'vitest';
import { createGame } from '@ichimon/sim';
import { layoutTree } from '../src/share/treeLayout';
import { treeSvg } from '../src/share/treeImage';
import { makeT } from '../src/i18n';

describe('系譜図の並べ方', () => {
  it('師匠は弟子たちの行の真ん中、弟子は右へ1段', () => {
    const { placed, rows, depth } = layoutTree([
      { id: 1, parentId: null },
      { id: 2, parentId: 1 },
      { id: 3, parentId: 1 },
      { id: 4, parentId: 3 },
      { id: 5, parentId: 3 },
    ]);
    const at = (id: number) => placed.find((p) => p.id === id)!;
    expect(rows).toBe(3);
    expect(depth).toBe(2);
    expect(at(2)).toMatchObject({ depth: 1, row: 0 });
    expect(at(3)).toMatchObject({ depth: 1, row: 1.5 });
    expect(at(1)).toMatchObject({ depth: 0, row: 0.75 });
  });

  it('親がいない節（閉じた部屋など）は根として並ぶ', () => {
    const { placed } = layoutTree([
      { id: 1, parentId: null },
      { id: 2, parentId: 99 },
    ]);
    expect(placed.map((p) => p.depth)).toEqual([0, 0]);
  });
});

describe('系譜図の画像', () => {
  it('部屋の名前と親方の名前が入った SVG になる（文字はエスケープ）', () => {
    const g = createGame({ seed: 2 });
    const { svg, width, height } = treeSvg(g, makeT('ja'));
    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg).toContain(g.stables[0]!.name);
    expect(svg).toContain(g.player.family[0]!.shikona);
    expect(width).toBeGreaterThan(200);
    expect(height).toBeGreaterThan(100);
  });
});
