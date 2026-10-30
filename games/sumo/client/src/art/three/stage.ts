/**
 * 錦絵の墨線と平たい色面を使った、コード製の立体土俵。
 * 描画だけを担当し、取組の勝敗・時刻・乱数には一切関与しない。
 */
import * as THREE from 'three';
import type { Arms } from '../Figure';
import type { Look } from '../look';
import { createIllustrator } from './figure3d';
import { PALETTE } from '../palette';
import type { Pose } from '../../playback/boutScript';
import { TAWARA_RADIUS, toStagePose } from './pose';
import { dohyoBales } from './dohyoDetails';

type Side = 'E' | 'W';

export interface StageInput {
  east: Look;
  west: Look;
  pose: { east: Pose; west: Pose };
  arms: Arms;
  winner: Side | null;
}

export interface MountedStage {
  update: (input: StageInput) => void;
  resize: () => void;
  dispose: () => void;
}

/** 素材・形状は一場面につき一度だけ作成し、終了時に確実に解放する */
export function mountStage(canvas: HTMLCanvasElement, initial: StageInput): MountedStage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: false,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.ai);
  const camera = new THREE.OrthographicCamera(-5.1, 5.1, 3.55, -3.55, 0.1, 60);
  camera.position.set(0, 4.3, 12.5);
  camera.lookAt(0, 2.35, -0.15);

  const { remember, material, part, ball, box, tube, createWrestler, dispose } = createIllustrator();

  scene.add(new THREE.AmbientLight(PALETTE.white, 1.9));
  const light = new THREE.DirectionalLight(PALETTE.white, 1.65);
  light.position.set(-3, 7, 9);
  scene.add(light);

  // 背景は錦絵の色面。実写の木目や過度なライト演出は加えない。
  box(scene, PALETTE.ai, [0, 2.35, -5.0], [13, 7, 0.15], false);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      const x = (col - 2.5) * 2.0 + (row % 2) * 0.7;
      const y = row * 0.72 + 0.2;
      tube(scene, PALETTE.sumi2, [
        new THREE.Vector3(x - 0.45, y, -4.88),
        new THREE.Vector3(x, y + 0.26, -4.88),
        new THREE.Vector3(x + 0.45, y, -4.88),
      ], 0.018);
    }
  }

  // 土俵は四角い盛り土の上に円形の勝負俵を置く。実際の土俵に近い輪郭にする。
  box(scene, PALETTE.sumi, [0, -0.025, 0.06], [8.12, 0.07, 8.12], false);
  box(scene, PALETTE.odo, [0, 0.33, 0], [7.9, 0.66, 7.9], true);
  const top = remember(new THREE.CylinderGeometry(3.74, 3.74, 0.11, 40));
  part(scene, top, PALETTE.odoLight, [0, 0.70, 0], [1, 1, 1], false);

  // 俵を一続きのゴム輪のようにせず、藁の束が並ぶ形で表現する。
  const baleGeometry = remember(new THREE.CylinderGeometry(0.145, 0.145, 0.69, 8));
  const up = new THREE.Vector3(0, 1, 0);
  for (const bale of dohyoBales()) {
    const cylinder = part(scene, baleGeometry, PALETTE.odoLight,
      [bale.x, 0.80, bale.z], [1, 1, 1], false);
    cylinder.quaternion.setFromUnitVectors(up, new THREE.Vector3(bale.dx, 0, bale.dz));
  }
  const innerInk = remember(new THREE.TorusGeometry(TAWARA_RADIUS - 0.16, 0.019, 4, 48));
  const inkRing = new THREE.Mesh(innerInk, material(PALETTE.sumi));
  inkRing.rotation.x = -Math.PI / 2;
  inkRing.position.y = 0.77;
  scene.add(inkRing);
  // 仕切り線（奥行き方向）。
  for (const x of [-0.43, 0.43]) box(scene, PALETTE.white, [x, 0.747, 0], [0.1, 0.013, 0.58], false);

  // 建物と土俵の陰影は写真風の影ではなく版画の明暗二色でつける。
  for (const y of [0.21, 0.41]) {
    box(scene, PALETTE.sumi2, [0, y, 3.96], [7.75, 0.025, 0.03], false);
  }

  // 吊り屋根・水引幕・房。カメラ視野に入る上半分を低ポリゴンで構成。
  box(scene, PALETTE.sumi, [0, 5.05, -1.2], [8.75, 0.23, 4.15], false);
  box(scene, PALETTE.odo, [0, 5.2, -1.2], [8.15, 0.16, 3.55], false);
  box(scene, PALETTE.murasaki, [0, 4.73, -1.2], [7.82, 0.45, 3.28], false);
  // 屋根下の梁。派手な装飾を足さず、木の組み物で立体感を出す。
  for (const z of [-2.65, 0.19]) {
    box(scene, PALETTE.sumi2, [0, 4.50, z], [7.85, 0.12, 0.13], false);
  }
  for (const x of [-3.52, 3.52]) {
    box(scene, PALETTE.odo, [x, 4.53, -1.2], [0.13, 0.17, 3.13], false);
  }
  for (const x of [-3.34, 3.34]) {
    const rope = remember(new THREE.CylinderGeometry(0.028, 0.028, 0.47, 6));
    part(scene, rope, PALETTE.sumi, [x, 4.19, 0.34], [1, 1, 1], false);
    const tassel = remember(new THREE.ConeGeometry(0.16, 0.46, 8));
    part(scene, tassel, x < 0 ? PALETTE.white : PALETTE.beni, [x, 3.74, 0.34], [1, 1, 1]);
  }

  const gyoji = new THREE.Group();
  // 行司は土俵の奥の正面に下げる。倒れた力士の進路（左右の俵）を空ける。
  gyoji.position.set(0, 0.70, -3.32);
  gyoji.scale.setScalar(0.82);
  scene.add(gyoji);
  ball(gyoji, PALETTE.murasaki, [0, 0.78, 0], [0.35, 0.6, 0.25]);
  ball(gyoji, PALETTE.skin[0], [0, 1.53, 0], [0.27, 0.29, 0.22]);
  const hat = remember(new THREE.ConeGeometry(0.20, 0.63, 5));
  part(gyoji, hat, PALETTE.sumi, [0, 2.01, 0], [1, 1, 1]);
  const fanPivot = new THREE.Group();
  fanPivot.position.set(0.23, 0.92, 0.27);
  gyoji.add(fanPivot);
  box(fanPivot, PALETTE.sumi, [0, 0.24, 0], [0.05, 0.52, 0.05], false);
  ball(fanPivot, PALETTE.odo, [0, 0.59, 0], [0.23, 0.29, 0.055]);

  const east = createWrestler(initial.east, scene);
  const west = createWrestler(initial.west, scene);
  // 足元に薄い印刷色の楕円を敷き、地面との接地だけを分かりやすくする。
  const shadowGeometry = remember(new THREE.CircleGeometry(1, 24));
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.sumi, transparent: true, opacity: 0.16, depthWrite: false,
  });
  const shadows = [east, west].map(() => {
    const mark = new THREE.Mesh(shadowGeometry, shadowMaterial);
    mark.rotation.x = -Math.PI / 2;
    mark.scale.set(0.72, 0.46, 1);
    mark.position.y = 0.766;
    scene.add(mark);
    return mark;
  });
  // 取組台本の初期位置に合わせ、互いに土俵の中心へ向ける。
  east.root.rotation.y = -0.24;
  west.root.rotation.y = 0.24;

  const resize = () => {
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width || 360));
    const height = Math.max(1, Math.round(bounds.height || 250));
    renderer.setSize(width, height, false);
    const halfHeight = 3.55;
    const halfWidth = halfHeight * (width / height);
    camera.left = -halfWidth;
    camera.right = halfWidth;
    camera.top = halfHeight;
    camera.bottom = -halfHeight;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  };

  const update = (input: StageInput) => {
    for (const [puppet, pose] of [
      [east, input.pose.east],
      [west, input.pose.west],
    ] as const) {
      const p = toStagePose(pose);
      puppet.root.position.set(p.x, 0.75, p.depth);
      puppet.tilt.rotation.z = p.tilt;
      for (let i = 0; i < 2; i++) puppet.arms[i]!.rotation.x = input.arms === 'push' ? -0.85 : 0;
    }
    for (let i = 0; i < shadows.length; i++) {
      const p = toStagePose(i === 0 ? input.pose.east : input.pose.west);
      shadows[i]!.position.x = p.x;
      shadows[i]!.position.z = p.depth;
    }
    fanPivot.rotation.z = input.winner === 'E' ? -0.75 : input.winner === 'W' ? 0.75 : 0;
    renderer.render(scene, camera);
  };

  resize();
  update(initial);
  return {
    update,
    resize,
    dispose: () => {
      dispose();
      shadowMaterial.dispose();
      renderer.dispose();
    },
  };
}
