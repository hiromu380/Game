/**
 * 土俵と肖像画で共用する木版画風の3D造形。
 * Lookだけから外見を決め、ゲームのシミュレーション値は変更しない。
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Look } from '../look';
import { PALETTE } from '../palette';

export interface Puppet {
  root: THREE.Group;
  tilt: THREE.Group;
  heading: THREE.Group;
  arms: [THREE.Group, THREE.Group];
  legs: [THREE.Group, THREE.Group];
}

export function createIllustrator() {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Map<string, THREE.Material>();
  const remember = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.add(geometry);
    return geometry;
  };
  const ramp = new THREE.DataTexture(new Uint8Array([120, 190, 255]), 3, 1, THREE.RedFormat);
  ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
  ramp.needsUpdate = true;
  const material = (color: string, outline = false): THREE.Material => {
    const key = `${outline ? 'outline' : 'paint'}:${color}`;
    const saved = materials.get(key);
    if (saved) return saved;
    const result = outline
      ? new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })
      : new THREE.MeshToonMaterial({ color, gradientMap: ramp });
    materials.set(key, result);
    return result;
  };
  const sphere = remember(new THREE.SphereGeometry(1, 18, 12));
  const cube = remember(new THREE.BoxGeometry(1, 1, 1));
  const ink = material(PALETTE.sumi, true);

  /** 二重の面による、3Dモデルのシルエット専用の細い墨線 */
  const part = (
    parent: THREE.Object3D,
    shape: THREE.BufferGeometry,
    color: string,
    pos: [number, number, number],
    scale: [number, number, number],
    bordered = true,
  ): THREE.Mesh => {
    const mesh = new THREE.Mesh(shape, material(color));
    mesh.position.set(...pos);
    mesh.scale.set(...scale);
    parent.add(mesh);
    if (bordered) {
      const shell = new THREE.Mesh(shape, ink);
      shell.position.copy(mesh.position);
      shell.rotation.copy(mesh.rotation);
      shell.scale.set(scale[0] + 0.022, scale[1] + 0.022, scale[2] + 0.022);
      parent.add(shell);
    }
    return mesh;
  };
  const ball = (
    parent: THREE.Object3D,
    color: string,
    pos: [number, number, number],
    scale: [number, number, number],
    border = true,
  ) => part(parent, sphere, color, pos, scale, border);
  const box = (
    parent: THREE.Object3D,
    color: string,
    pos: [number, number, number],
    scale: [number, number, number],
    border = true,
  ) => part(parent, cube, color, pos, scale, border);
  const tube = (parent: THREE.Object3D, color: string, points: THREE.Vector3[], radius = 0.028) => {
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = remember(new THREE.TubeGeometry(curve, 12, radius, 5, false));
    parent.add(new THREE.Mesh(geo, material(color)));
  };

  /** 同じ支点・色の面をまとめ、顔の線一本ごとの描画命令を減らす。 */
  const bake = (group: THREE.Object3D) => {
    const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const child of [...group.children]) {
      if (!(child instanceof THREE.Mesh)) {
        bake(child);
        continue;
      }
      if (Array.isArray(child.material)) continue;
      child.updateMatrix();
      const transformed = child.geometry.clone().applyMatrix4(child.matrix);
      // ExtrudeGeometryは非インデックス、球や箱はインデックス付き。形式を揃えて欠落を防ぐ。
      const geometry = transformed.index ? transformed.toNonIndexed() : transformed;
      if (geometry !== transformed) transformed.dispose();
      const list = buckets.get(child.material) ?? [];
      list.push(geometry);
      buckets.set(child.material, list);
      group.remove(child);
    }
    for (const [paint, geometries] of buckets) {
      const geometry = mergeGeometries(geometries);
      for (const original of geometries) original.dispose();
      if (!geometry) throw new Error('3Dの色面を統合できませんでした');
      group.add(new THREE.Mesh(remember(geometry), paint));
    }
  };

  const createWrestler = (look: Look, parent: THREE.Object3D): Puppet => {
    const root = new THREE.Group();
    const tilt = new THREE.Group();
    const figure = new THREE.Group();
    root.add(tilt);
    tilt.position.y = 0.84;
    figure.position.y = -0.84;
    tilt.add(figure);
    parent.add(root);

    const w = 0.67 + ((look.width - 26) / 20) * 0.34;
    // 股関節を支点に脚を分離し、すり足と短い四股の動きを加えられるようにする。
    const legs: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
    for (let i = 0; i < 2; i++) {
      const leg = legs[i]!;
      const side = i === 0 ? -1 : 1;
      leg.position.set(side * w * 0.53, 0.73, 0);
      figure.add(leg);
      if (!look.kimono) ball(leg, look.skin, [0, -0.26, 0], [0.29, 0.44, 0.34]);
      ball(leg, look.skin, [0, -0.56, 0.2], [0.34, 0.17, 0.46]);
    }
    ball(figure, look.kimono ? look.cloth : look.skin, [0, 1.22, 0], [w, 0.8, 0.63]);
    const arms: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const pivot = arms[i]!;
      pivot.position.set(side * w * 0.9, 1.65, 0.03);
      figure.add(pivot);
      if (look.kimono) {
        box(pivot, look.cloth, [side * 0.08, -0.28, 0], [0.44, 0.7, 0.56]);
      } else {
        ball(pivot, look.skin, [side * 0.08, -0.28, 0.09], [0.29, 0.48, 0.32]);
      }
      ball(pivot, look.skin, [side * 0.1, -0.58, 0.14], [0.23, 0.2, 0.25]);
    }

    if (look.kimono) {
      const robe = remember(new THREE.CylinderGeometry(w * 0.84, w * 1.06, 1.24, 12));
      part(figure, robe, look.cloth, [0, 0.83, 0], [1, 1, 0.8]);
      tube(
        figure,
        PALETTE.sumi,
        [new THREE.Vector3(0.12, 1.0, 0.6), new THREE.Vector3(0.12, 0.23, 0.61)],
        0.015,
      );
      box(figure, PALETTE.odo, [0, 0.94, 0.65], [w * 1.45, 0.13, 0.09]);
      tube(
        figure,
        PALETTE.washi,
        [new THREE.Vector3(-0.24, 1.86, 0.5), new THREE.Vector3(0.1, 1.36, 0.65)],
        0.055,
      );
      tube(
        figure,
        PALETTE.washi,
        [new THREE.Vector3(0.24, 1.86, 0.5), new THREE.Vector3(-0.09, 1.38, 0.65)],
        0.055,
      );
      for (const side of [-1, 1]) {
        ball(figure, PALETTE.washi, [side * 0.36, 1.64, 0.51], [0.06, 0.06, 0.015], false);
        ball(figure, look.cloth, [side * 0.36, 1.64, 0.535], [0.025, 0.025, 0.01], false);
      }
    } else {
      // 胸と腹の線は必要な箇所だけに置き、球を並べた印象を和らげる。
      for (const side of [-1, 1]) {
        tube(
          figure,
          PALETTE.sumi2,
          [
            new THREE.Vector3(side * 0.14, 1.6, 0.55),
            new THREE.Vector3(side * 0.33, 1.55, 0.57),
            new THREE.Vector3(side * 0.47, 1.6, 0.53),
          ],
          0.013,
        );
      }
      tube(
        figure,
        PALETTE.sumi2,
        [
          new THREE.Vector3(-0.04, 1.19, 0.635),
          new THREE.Vector3(0, 1.17, 0.65),
          new THREE.Vector3(0.04, 1.19, 0.635),
        ],
        0.015,
      );
      const sash = remember(new THREE.CylinderGeometry(0.7, 0.72, 0.29, 24));
      part(figure, sash, look.cloth, [0, 0.94, 0], [w / 0.7, 1, 0.96]);
      box(figure, look.cloth, [0, 0.66, 0.61], [0.29, 0.52, 0.11]);
      if (look.sagari)
        for (let i = -5; i <= 5; i++) {
          box(figure, look.cloth, [i * 0.075, 0.62, 0.71], [0.018, 0.42, 0.025], false);
        }
      if (look.tsuna) {
        const tsuna = remember(new THREE.TorusGeometry(0.78, 0.085, 7, 26));
        const cord = part(figure, tsuna, PALETTE.white, [0, 1.13, 0], [w / 0.75, 1, 0.93], false);
        cord.rotation.x = Math.PI / 2;
        for (let i = -1; i <= 1; i++)
          box(figure, PALETTE.white, [i * 0.22, 0.85, 0.71], [0.12, 0.29, 0.02]);
      }
    }

    // 顔の表情は既存 Look の目・眉・口を忠実に参照。
    ball(
      figure,
      look.skin,
      [0, 2.25, 0.0],
      [look.brows === 'thick' ? 0.69 : 0.64, look.eyes === 'sharp' ? 0.61 : 0.65, 0.6],
    );
    for (const side of [-1, 1]) {
      ball(figure, look.skin, [side * 0.62, 2.24, 0.02], [0.11, 0.2, 0.16]);
      ball(figure, PALETTE.cheek, [side * 0.4, 2.12, 0.49], [0.13, 0.07, 0.025], false);
      const x = side * 0.22;
      if (look.eyes === 'dot') {
        ball(figure, PALETTE.sumi, [x, 2.29, 0.606], [0.047, 0.052, 0.025], false);
      } else if (look.eyes === 'line') {
        box(figure, PALETTE.sumi, [x, 2.29, 0.612], [0.13, 0.025, 0.024], false);
      } else if (look.eyes === 'smile') {
        tube(
          figure,
          PALETTE.sumi,
          [
            new THREE.Vector3(x - 0.07, 2.27, 0.605),
            new THREE.Vector3(x, 2.31, 0.628),
            new THREE.Vector3(x + 0.07, 2.27, 0.605),
          ],
          0.025,
        );
      } else {
        ball(figure, PALETTE.washi, [x, 2.29, 0.593], [0.105, 0.07, 0.035], false);
        ball(figure, PALETTE.sumi, [x - side * 0.025, 2.29, 0.63], [0.037, 0.045, 0.017], false);
        tube(
          figure,
          PALETTE.sumi,
          [
            new THREE.Vector3(x - 0.075, 2.32 - side * 0.03, 0.59),
            new THREE.Vector3(x + 0.075, 2.28 + side * 0.03, 0.61),
          ],
          0.03,
        );
      }
      const browY = look.brows === 'angry' ? 2.49 - side * 0.02 : 2.48;
      const browSlope = look.brows === 'arched' ? 0.06 : look.brows === 'angry' ? -side * 0.07 : 0;
      tube(
        figure,
        PALETTE.sumi,
        [
          new THREE.Vector3(x - 0.11, browY, 0.568),
          new THREE.Vector3(x + 0.11, browY + browSlope, 0.568),
        ],
        look.brows === 'thick' ? 0.052 : 0.033,
      );
    }
    ball(figure, look.skin, [0, 2.18, 0.64], [0.08, 0.09, 0.075], false);
    if (look.mouth === 'o') {
      ball(figure, PALETTE.beni, [0, 2.02, 0.61], [0.06, 0.075, 0.022], false);
    } else {
      const upward = look.mouth === 'smile' ? 0.055 : look.mouth === 'he' ? -0.05 : 0;
      tube(
        figure,
        PALETTE.sumi,
        [
          new THREE.Vector3(-0.105, 2.04 + upward, 0.595),
          new THREE.Vector3(0, 2.04, 0.625),
          new THREE.Vector3(0.105, 2.04 + upward, 0.595),
        ],
        0.028,
      );
    }

    // 大銀杏は先の広がった銀杏の葉型。ちょんまげとは輪郭で区別できる。
    const hair = look.hair === 'gray' ? PALETTE.muted : PALETTE.sumi;
    ball(figure, hair, [0, 2.7, -0.06], [0.64, 0.27, 0.52]);
    if (look.hair === 'zanbara') {
      for (let i = -3; i <= 3; i++) {
        ball(
          figure,
          hair,
          [i * 0.17, 2.59 + ((i + 4) % 3) * 0.045, 0.39],
          [0.13, 0.18, 0.16],
          false,
        );
      }
    } else if (look.hair === 'chonmage') {
      ball(figure, hair, [0, 2.93, -0.1], [0.16, 0.28, 0.22]);
    } else if (look.hair === 'oicho') {
      // 髷を頭の上で前へ折り返す。葉先は寝かせ、冠のように直立させない。
      ball(figure, hair, [0, 2.91, -0.29], [0.15, 0.17, 0.23]);
      const fan = new THREE.Shape();
      fan.moveTo(-0.09, 0);
      fan.bezierCurveTo(-0.14, 0.15, -0.43, 0.29, -0.43, 0.43);
      fan.quadraticCurveTo(-0.25, 0.57, -0.06, 0.51);
      fan.quadraticCurveTo(0, 0.46, 0.06, 0.51);
      fan.quadraticCurveTo(0.25, 0.57, 0.43, 0.43);
      fan.bezierCurveTo(0.43, 0.29, 0.14, 0.15, 0.09, 0);
      fan.closePath();
      const leaf = remember(
        new THREE.ExtrudeGeometry(fan, { depth: 0.12, bevelEnabled: false, curveSegments: 8 }),
      );
      const knot = new THREE.Group();
      knot.position.set(0, 3.02, -0.03);
      knot.rotation.x = Math.PI * 0.41;
      figure.add(knot);
      part(knot, leaf, hair, [0, 0, 0], [1, 1, 1]);
      for (const x of [-0.3, -0.15, 0, 0.15, 0.3]) {
        tube(
          knot,
          PALETTE.hairLight,
          [new THREE.Vector3(x * 0.12, 0.08, 0.125), new THREE.Vector3(x, 0.44, 0.125)],
          0.009,
        );
      }
      box(knot, PALETTE.washi, [0, 0.1, 0.14], [0.22, 0.035, 0.025], false);
    }

    if (look.bandage) {
      box(figure, PALETTE.white, [-w * 1.01, 1.26, 0.33], [0.18, 0.15, 0.13]);
      box(figure, PALETTE.white, [0.39, 2.04, 0.515], [0.19, 0.085, 0.027]);
    }
    if (look.sweat) {
      ball(figure, PALETTE.aiLight, [0.69, 2.24, 0.17], [0.065, 0.16, 0.08]);
    }
    bake(figure);
    return { root, tilt, heading: figure, arms, legs };
  };

  const dispose = () => {
    ramp.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const value of materials.values()) value.dispose();
  };

  return { remember, material, part, ball, box, tube, bake, createWrestler, dispose };
}
