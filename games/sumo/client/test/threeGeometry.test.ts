import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createIllustrator } from '../src/art/three/figure3d';
import { PALETTE } from '../src/art/palette';
import { rikishiLook } from '../src/art/look';

describe('手続きモデルの形状保持', () => {
  it('球と押出し形状が混在しても、統合で三角形と色面を失わない', () => {
    const art = createIllustrator();
    const group = new THREE.Group();
    art.ball(group, PALETTE.sumi, [0, 0, 0], [1, 1, 1], false);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(1, 0);
    shape.lineTo(0, 1);
    shape.closePath();
    const geometry = art.remember(
      new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false }),
    );
    art.part(group, geometry, PALETTE.sumi, [2, 0, 0], [1, 1, 1], false);
    const vertices = group.children.reduce((n, child) => {
      const g = (child as THREE.Mesh).geometry;
      return n + (g.index?.count ?? g.attributes.position!.count);
    }, 0);
    art.bake(group);
    expect(group.children).toHaveLength(1);
    expect((group.children[0] as THREE.Mesh).geometry.attributes.position!.count).toBe(vertices);
    const bounds = new THREE.Box3().setFromObject(group, true);
    expect(bounds.max.x).toBeGreaterThanOrEqual(3);
    art.dispose();
  });

  it('全髪型・軽重・けがのモデルを有限の範囲で構築でき、頭の上に冠状の突起を作らない', () => {
    for (const [weight, careerBasho, sekitori] of [
      [95, 2, false],
      [125, 20, false],
      [175, 40, true],
    ] as const) {
      const art = createIllustrator();
      const scene = new THREE.Group();
      const look = rikishiLook({
        id: 4,
        weight,
        careerBasho,
        sekitori,
        stableId: 1,
        yokozuna: sekitori,
        injured: true,
        fatigue: 70,
      });
      art.createWrestler(look, scene);
      const bounds = new THREE.Box3().setFromObject(scene, true);
      expect(bounds.max.y).toBeLessThan(3.4);
      expect(bounds.min.y).toBeGreaterThan(-0.1);
      expect(Number.isFinite(bounds.max.x)).toBe(true);
      art.dispose();
    }
  });
});
