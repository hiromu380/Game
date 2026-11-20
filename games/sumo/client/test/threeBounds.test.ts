import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createBoundsReader } from '../src/art/three/bounds';
import { createIllustrator } from '../src/art/three/figure3d';
import { rikishiLook } from '../src/art/look';

describe('接地用の頂点測定', () => {
  it('体・腕・脚の回転後も全頂点測定と同じ外形を返す', () => {
    const art = createIllustrator();
    const scene = new THREE.Group();
    const puppet = art.createWrestler(
      rikishiLook({
        id: 4,
        weight: 175,
        stableId: 1,
        careerBasho: 40,
        sekitori: true,
        yokozuna: true,
        injured: true,
        fatigue: 70,
      }),
      scene,
    );
    const read = createBoundsReader(puppet.root);
    const actual = new THREE.Box3();
    for (const tilt of [0, 0.7, -1.5, 2.1]) {
      puppet.root.position.set(-2.3, 0.76, 0.4);
      puppet.tilt.rotation.z = tilt;
      puppet.heading.rotation.y = 1.04;
      puppet.arms[0].rotation.x = -0.72;
      puppet.legs[1].rotation.z = 0.3;
      read(actual);
      const expected = new THREE.Box3().setFromObject(puppet.root, true);
      expect(actual.min.distanceTo(expected.min)).toBeLessThan(1e-9);
      expect(actual.max.distanceTo(expected.max)).toBeLessThan(1e-9);
    }
    art.dispose();
  });
});
