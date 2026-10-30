/**
 * 土俵と肖像画で共用する木版画風の3D造形。
 * Lookだけから外見を決め、ゲームのシミュレーション値は変更しない。
 */
import * as THREE from 'three';
import type { Look } from '../look';
import { PALETTE } from '../palette';

export interface Puppet {
  root: THREE.Group;
  tilt: THREE.Group;
  arms: [THREE.Group, THREE.Group];
}

export function createIllustrator() {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Map<string, THREE.Material>();
  const remember = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.add(geometry);
    return geometry;
  };
  const material = (color: string, outline = false): THREE.Material => {
    const key = `${outline ? 'outline' : 'paint'}:${color}`;
    const saved = materials.get(key);
    if (saved) return saved;
    const result = outline
      ? new THREE.MeshBasicMaterial({ color, side: THREE.BackSide })
      : new THREE.MeshToonMaterial({ color });
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
      shell.scale.set(scale[0] * 1.055, scale[1] * 1.055, scale[2] * 1.055);
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
  const tube = (
    parent: THREE.Object3D,
    color: string,
    points: THREE.Vector3[],
    radius = 0.028,
  ) => {
    const curve = new THREE.CatmullRomCurve3(points);
    const geo = remember(new THREE.TubeGeometry(curve, 12, radius, 5, false));
    parent.add(new THREE.Mesh(geo, material(color)));
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
    // 足・手は短く、頭は大きい二頭身。丸みだけを3D化する。
    for (const side of [-1, 1]) {
      ball(figure, look.skin, [side * w * 0.53, 0.47, 0], [0.29, 0.44, 0.34]);
      ball(figure, look.skin, [side * w * 0.54, 0.17, 0.2], [0.34, 0.17, 0.46]);
    }
    ball(figure, look.kimono ? look.cloth : look.skin, [0, 1.22, 0], [w, 0.8, 0.63]);
    const arms: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const pivot = arms[i]!;
      pivot.position.set(side * w * 0.9, 1.65, 0.03);
      figure.add(pivot);
      ball(pivot, look.kimono ? look.cloth : look.skin, [side * 0.08, -0.28, 0.09], [0.29, 0.48, 0.32]);
      ball(pivot, look.skin, [side * 0.1, -0.58, 0.14], [0.23, 0.2, 0.25]);
    }

    if (look.kimono) {
      box(figure, PALETTE.odo, [0, 0.94, 0.65], [w * 1.45, 0.13, 0.09]);
      tube(figure, PALETTE.white, [
        new THREE.Vector3(-0.19, 1.84, 0.53),
        new THREE.Vector3(0.02, 1.45, 0.67),
        new THREE.Vector3(0.18, 1.83, 0.53),
      ], 0.05);
    } else {
      const sash = remember(new THREE.CylinderGeometry(0.70, 0.72, 0.29, 24));
      part(figure, sash, look.cloth, [0, 0.94, 0], [w / 0.70, 1, 0.96]);
      box(figure, look.cloth, [0, 0.66, 0.61], [0.29, 0.52, 0.11]);
      if (look.sagari) for (let i = -2; i <= 2; i++) {
        box(figure, look.cloth, [i * 0.085, 0.62, 0.71], [0.028, 0.42, 0.025], false);
      }
      if (look.tsuna) {
        const tsuna = remember(new THREE.TorusGeometry(0.78, 0.085, 7, 26));
        const cord = part(figure, tsuna, PALETTE.white, [0, 1.13, 0], [w / 0.75, 1, 0.93], false);
        cord.rotation.x = Math.PI / 2;
        for (let i = -1; i <= 1; i++) box(figure, PALETTE.white, [i * 0.22, 0.85, 0.71], [0.12, 0.29, 0.02]);
      }
    }

    // 顔の表情は既存 Look の目・眉・口を忠実に参照。
    ball(figure, look.skin, [0, 2.25, 0.0], [0.65, 0.65, 0.60]);
    for (const side of [-1, 1]) {
      ball(figure, look.skin, [side * 0.62, 2.24, 0.02], [0.11, 0.2, 0.16]);
      ball(figure, PALETTE.cheek, [side * 0.40, 2.12, 0.49], [0.13, 0.07, 0.025], false);
      const x = side * 0.22;
      if (look.eyes === 'dot') {
        ball(figure, PALETTE.sumi, [x, 2.29, 0.606], [0.047, 0.052, 0.025], false);
      } else if (look.eyes === 'line') {
        box(figure, PALETTE.sumi, [x, 2.29, 0.612], [0.13, 0.025, 0.024], false);
      } else if (look.eyes === 'smile') {
        tube(figure, PALETTE.sumi, [
          new THREE.Vector3(x - 0.07, 2.27, 0.605),
          new THREE.Vector3(x, 2.31, 0.628),
          new THREE.Vector3(x + 0.07, 2.27, 0.605),
        ], 0.025);
      } else {
        tube(figure, PALETTE.sumi, [
          new THREE.Vector3(x - 0.075, 2.32 - side * 0.03, 0.59),
          new THREE.Vector3(x + 0.075, 2.28 + side * 0.03, 0.61),
        ], 0.03);
      }
      const browY = look.brows === 'angry' ? 2.49 - side * 0.02 : 2.48;
      const browSlope = look.brows === 'arched' ? 0.06 : look.brows === 'angry' ? -side * 0.07 : 0;
      tube(figure, PALETTE.sumi, [
        new THREE.Vector3(x - 0.11, browY, 0.568),
        new THREE.Vector3(x + 0.11, browY + browSlope, 0.568),
      ], look.brows === 'thick' ? 0.052 : 0.033);
    }
    ball(figure, look.skin, [0, 2.18, 0.64], [0.08, 0.09, 0.075], false);
    if (look.mouth === 'o') {
      ball(figure, PALETTE.beni, [0, 2.02, 0.61], [0.06, 0.075, 0.022], false);
    } else {
      const upward = look.mouth === 'smile' ? 0.055 : look.mouth === 'he' ? -0.05 : 0;
      tube(figure, PALETTE.sumi, [
        new THREE.Vector3(-0.105, 2.04 + upward, 0.595),
        new THREE.Vector3(0, 2.04, 0.625),
        new THREE.Vector3(0.105, 2.04 + upward, 0.595),
      ], 0.028);
    }

    // 大銀杏は先の広がった銀杏の葉型。ちょんまげとは輪郭で区別できる。
    const hair = look.hair === 'gray' ? PALETTE.muted : PALETTE.sumi;
    ball(figure, hair, [0, 2.7, -0.06], [0.64, 0.27, 0.52]);
    if (look.hair === 'zanbara') {
      for (let i = -3; i <= 3; i++) {
        ball(figure, hair, [i * 0.17, 2.59 + ((i + 4) % 3) * 0.045, 0.39], [0.13, 0.18, 0.16], false);
      }
    } else if (look.hair === 'chonmage') {
      ball(figure, hair, [0, 2.93, -0.1], [0.16, 0.28, 0.22]);
    } else if (look.hair === 'oicho') {
      const fan = new THREE.Shape();
      fan.moveTo(-0.12, 0);
      fan.bezierCurveTo(-0.55, 0.14, -0.67, 0.36, -0.62, 0.48);
      fan.quadraticCurveTo(0, 0.72, 0.62, 0.48);
      fan.bezierCurveTo(0.67, 0.36, 0.55, 0.14, 0.12, 0);
      fan.lineTo(-0.12, 0);
      const leaf = remember(new THREE.ExtrudeGeometry(fan, { depth: 0.085, bevelEnabled: false }));
      part(figure, leaf, hair, [0, 2.83, -0.15], [1, 1, 1]);
      box(figure, PALETTE.washi, [0, 2.87, 0.48], [0.29, 0.045, 0.05], false);
    }

    if (look.bandage) {
      box(figure, PALETTE.white, [-w * 1.01, 1.26, 0.33], [0.18, 0.15, 0.13]);
      box(figure, PALETTE.white, [0.39, 2.04, 0.515], [0.19, 0.085, 0.027]);
    }
    if (look.sweat) {
      ball(figure, PALETTE.aiLight, [0.69, 2.24, 0.17], [0.065, 0.16, 0.08]);
    }
    return { root, tilt, arms };
  };

  const dispose = () => {
    for (const geometry of geometries) geometry.dispose();
    for (const value of materials.values()) value.dispose();
  };

  return { remember, material, part, ball, box, tube, createWrestler, dispose };
}
