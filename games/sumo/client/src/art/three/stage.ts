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
import { wrestlerMotion, type MotionClock } from './animation';
import { chooseRenderQuality, shouldRenderFrame } from './quality';

type Side = 'E' | 'W';

export interface StageInput {
  east: Look;
  west: Look;
  pose: { east: Pose; west: Pose };
  arms: Arms;
  winner: Side | null;
  /** 描画専用。省略時は最終姿勢で静止する。 */
  motion?: MotionClock;
}

export interface MountedStage {
  update: (input: StageInput) => void;
  resize: () => void;
  dispose: () => void;
  metrics: () => {
    frames: number;
    fps: number;
    cpuMs: number;
    calls: number;
    geometries: number;
    textures: number;
    pixelRatio: number;
  };
}

/** 素材・形状は一場面につき一度だけ作成し、終了時に確実に解放する */
export function mountStage(canvas: HTMLCanvasElement, initial: StageInput): MountedStage {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: false,
    antialias: true,
    powerPreference: 'low-power',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PALETTE.washi2);
  const camera = new THREE.OrthographicCamera(-5.1, 5.1, 3.55, -3.55, 0.1, 60);
  camera.position.set(0, 6.4, 13.5);
  camera.lookAt(0, 2.45, -0.15);

  let frames = 0;
  let firstFrameAt = 0;
  let lastFrameAt = 0;
  let cpuTotal = 0;
  const draw = () => {
    const start = performance.now();
    renderer.render(scene, camera);
    const end = performance.now();
    if (!frames) firstFrameAt = start;
    lastFrameAt = start;
    frames++;
    cpuTotal += end - start;
  };
  const { remember, material, part, ball, box, tube, bake, createWrestler, dispose } =
    createIllustrator();

  let shadowMaterial: THREE.MeshToonMaterial | undefined;
  try {
    scene.add(new THREE.AmbientLight(PALETTE.white, 1.65));
    const light = new THREE.DirectionalLight(PALETTE.white, 1.15);
    light.position.set(-3, 7, 9);
    scene.add(light);

    // 背景は錦絵の色面。実写の木目や過度なライト演出は加えない。
    box(scene, PALETTE.washi2, [0, 2.35, -5.0], [13, 7, 0.15], false);
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 6; col++) {
        const x = (col - 2.5) * 2.0 + (row % 2) * 0.7;
        const y = row * 0.72 + 0.2;
        tube(
          scene,
          PALETTE.odo,
          [
            new THREE.Vector3(x - 0.45, y, -4.88),
            new THREE.Vector3(x, y + 0.26, -4.88),
            new THREE.Vector3(x + 0.45, y, -4.88),
          ],
          0.018,
        );
      }
    }

    // 外に出た足も地面で受け止める。勝敗判定には使用しない。
    box(scene, PALETTE.odoLight, [0, 0.02, 0], [14, 0.04, 11], false);
    // 土俵は四角い盛り土の上に円形の勝負俵を置く。実際の土俵に近い輪郭にする。
    box(scene, PALETTE.sumi, [0, -0.025, 0.06], [10.4, 0.07, 10.4], false);
    box(scene, PALETTE.odo, [0, 0.33, 0], [10.2, 0.66, 10.2], true);
    const top = remember(new THREE.CylinderGeometry(3.74, 3.74, 0.11, 40));
    part(scene, top, PALETTE.odoLight, [0, 0.7, 0], [1, 1, 1], false);

    // 俵を一続きのゴム輪のようにせず、藁の束が並ぶ形で表現する。
    const baleGeometry = remember(new THREE.CylinderGeometry(0.145, 0.145, 0.69, 8));
    const up = new THREE.Vector3(0, 1, 0);
    for (const bale of dohyoBales()) {
      const cylinder = part(
        scene,
        baleGeometry,
        PALETTE.odo,
        [bale.x, 0.8, bale.z],
        [1, 1, 1],
        false,
      );
      cylinder.quaternion.setFromUnitVectors(up, new THREE.Vector3(bale.dx, 0, bale.dz));
    }
    const innerInk = remember(new THREE.TorusGeometry(TAWARA_RADIUS - 0.16, 0.019, 4, 48));
    const inkRing = new THREE.Mesh(innerInk, material(PALETTE.sumi));
    inkRing.rotation.x = -Math.PI / 2;
    inkRing.position.y = 0.77;
    scene.add(inkRing);
    // 仕切り線（奥行き方向）。
    for (const x of [-0.43, 0.43])
      box(scene, PALETTE.white, [x, 0.747, 0], [0.1, 0.013, 0.58], false);

    // 建物と土俵の陰影は写真風の影ではなく版画の明暗二色でつける。
    for (const y of [0.21, 0.41]) {
      box(scene, PALETTE.sumi2, [0, y, 3.96], [10.0, 0.025, 0.03], false);
    }

    // 吊り屋根・水引幕・房。カメラ視野に入る上半分を低ポリゴンで構成。
    const roof = new THREE.Shape();
    roof.moveTo(-4.65, 4.95);
    roof.quadraticCurveTo(-3.2, 5.02, 0, 5.58);
    roof.quadraticCurveTo(3.2, 5.02, 4.65, 4.95);
    roof.lineTo(4.42, 4.8);
    roof.quadraticCurveTo(0, 5.12, -4.42, 4.8);
    roof.closePath();
    const roofGeometry = remember(
      new THREE.ExtrudeGeometry(roof, { depth: 2.8, bevelEnabled: false, curveSegments: 10 }),
    );
    part(scene, roofGeometry, PALETTE.sumi2, [0, 0, -2.75], [1, 1, 1]);
    box(scene, PALETTE.odo, [0, 4.91, 0.13], [8.8, 0.1, 0.15], false);
    box(scene, PALETTE.murasaki, [0, 4.73, -1.2], [7.82, 0.45, 3.28], false);
    for (const x of [-2.35, 2.35]) {
      const crest = remember(new THREE.TorusGeometry(0.17, 0.025, 5, 18));
      part(scene, crest, PALETTE.washi, [x, 4.72, 0.46], [1, 1, 1], false);
      box(scene, PALETTE.washi, [x, 4.72, 0.47], [0.23, 0.03, 0.02], false);
    }
    // 屋根下の梁。派手な装飾を足さず、木の組み物で立体感を出す。
    for (const z of [-2.65, 0.19]) {
      box(scene, PALETTE.sumi2, [0, 4.5, z], [7.85, 0.12, 0.13], false);
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

    bake(scene);
    const gyoji = new THREE.Group();
    // 行司は土俵の奥の正面に下げる。倒れた力士の進路（左右の俵）を空ける。
    gyoji.position.set(0, 0.75, -2.7);
    gyoji.scale.setScalar(0.95);
    scene.add(gyoji);
    ball(gyoji, PALETTE.murasaki, [0, 0.78, 0], [0.35, 0.6, 0.25]);
    ball(gyoji, PALETTE.skin[0], [0, 1.53, 0], [0.27, 0.29, 0.22]);
    const hat = remember(new THREE.ConeGeometry(0.2, 0.63, 5));
    part(gyoji, hat, PALETTE.sumi, [0, 2.01, 0], [1, 1, 1]);
    const fanPivot = new THREE.Group();
    fanPivot.position.set(0.23, 0.92, 0.27);
    gyoji.add(fanPivot);
    box(fanPivot, PALETTE.sumi, [0, 0.24, 0], [0.05, 0.52, 0.05], false);
    ball(fanPivot, PALETTE.odo, [0, 0.59, 0], [0.23, 0.29, 0.055]);

    // 行司の足・袖・白襟。輪郭で職業が分かる造形に揃える。
    for (const side of [-1, 1]) {
      ball(gyoji, PALETTE.white, [side * 0.16, 0.08, 0.1], [0.14, 0.08, 0.22]);
      box(gyoji, PALETTE.murasaki, [side * 0.34, 1.0, 0], [0.3, 0.48, 0.32]);
      ball(gyoji, PALETTE.sumi, [side * 0.09, 1.56, 0.22], [0.025, 0.035, 0.02], false);
      tube(
        gyoji,
        PALETTE.white,
        [new THREE.Vector3(side * 0.11, 1.25, 0.22), new THREE.Vector3(0, 1.03, 0.29)],
        0.025,
      );
    }
    const east = createWrestler(initial.east, scene);
    const west = createWrestler(initial.west, scene);
    // 足元に薄い印刷色の楕円を敷き、地面との接地だけを分かりやすくする。
    const shadowGeometry = remember(new THREE.CircleGeometry(1, 24));
    shadowMaterial = material(PALETTE.sumi).clone() as THREE.MeshToonMaterial;
    shadowMaterial.setValues({
      color: PALETTE.sumi,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
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
    east.heading.rotation.y = -1.04;
    west.heading.rotation.y = 1.04;
    east.root.scale.setScalar(0.95);
    west.root.scale.setScalar(0.95);
    const bounds = new THREE.Box3();

    let disposed = false;
    let lastDrawAt = Number.NEGATIVE_INFINITY;
    let previousWinner: Side | null = null;
    let lastSize = '';
    const coarsePointer =
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    let quality = chooseRenderQuality(360, 250, window.devicePixelRatio || 1, coarsePointer);
    const resize = () => {
      if (disposed) return;
      const bounds = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width || 360));
      const height = Math.max(1, Math.round(bounds.height || 250));
      quality = chooseRenderQuality(width, height, window.devicePixelRatio || 1, coarsePointer);
      const sizeKey = `${width}:${height}:${quality.pixelRatio}`;
      if (sizeKey === lastSize) {
        draw();
        return;
      }
      lastSize = sizeKey;
      renderer.setPixelRatio(quality.pixelRatio);
      renderer.setSize(width, height, false);
      // 狭い画面でも東西の俵と倒れた力士を見切れさせない。
      const halfWidth = Math.max(5.9, (3.7 * width) / height);
      const halfHeight = (halfWidth * height) / width;
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.top = halfHeight;
      camera.bottom = -halfHeight;
      camera.updateProjectionMatrix();
      draw();
    };

    const update = (input: StageInput) => {
      if (disposed) return;
      for (const [index, puppet, pose, side] of [
        [0, east, input.pose.east, 'E'],
        [1, west, input.pose.west, 'W'],
      ] as const) {
        const p = toStagePose(pose);
        const movement = wrestlerMotion(input.motion, pose, side, input.arms);
        // 勝敗と位置は台本からのみ取得。四股・腰・腕・脚は表示用の補間に限定する。
        const other = toStagePose(side === 'E' ? input.pose.west : input.pose.east);
        const midpoint = (p.x + other.x) / 2;
        // 二次元の点を立体に替えたときの胴の貫通を、描画の間隔だけで補正する。
        const x =
          Math.abs(pose.rot) < 20 && Math.abs(p.x - other.x) < 1.7
            ? midpoint + (side === 'E' ? 0.85 : -0.85)
            : p.x;
        puppet.root.position.set(x, 0, p.depth);
        puppet.tilt.rotation.z = p.tilt + movement.leanZ;
        puppet.tilt.scale.y = movement.bodyScaleY;
        for (let i = 0; i < 2; i++) {
          puppet.arms[i]!.rotation.x = movement.armsX;
          puppet.legs[i]!.rotation.z = movement.legsZ[i]!;
          puppet.legs[i]!.rotation.x = movement.legsX[i]!;
        }
        // 倒れた頭・肩・足のうち最も低い面を土俵に合わせ、浮きとめり込みを防ぐ。
        puppet.root.updateMatrixWorld(true);
        bounds.setFromObject(puppet.root, true);
        puppet.root.position.y = 0.76 - bounds.min.y;
        const shadow = shadows[index]!;
        shadow.position.x = x;
        shadow.position.z = p.depth;
        shadow.scale.x = 0.72 * movement.shadowScale;
        shadow.scale.y = 0.46 * movement.shadowScale;
      }
      const eastBox = new THREE.Box3().setFromObject(east.root, true);
      const westBox = new THREE.Box3().setFromObject(west.root, true);
      for (const [puppet, box, other, pose] of [
        [east, eastBox, westBox, input.pose.east],
        [west, westBox, eastBox, input.pose.west],
      ] as const) {
        if (Math.abs(pose.rot) <= 20) continue;
        // 倒れた体が立つ相手を貫かないよう、表示上の着地点を確保する。
        const left = box.getCenter(new THREE.Vector3()).x < other.getCenter(new THREE.Vector3()).x;
        const overlap = left ? box.max.x - other.min.x + 0.06 : other.max.x - box.min.x + 0.06;
        if (overlap > 0) {
          const shift = (left ? -1 : 1) * overlap;
          puppet.root.position.x += shift;
          box.translate(new THREE.Vector3(shift, 0, 0));
        }
      }
      const canvasBounds = canvas.getBoundingClientRect();
      const ratio = (canvasBounds.height || 250) / (canvasBounds.width || 360);
      const halfWidth = Math.max(
        5.3,
        Math.abs(eastBox.min.x) + 0.4,
        Math.abs(eastBox.max.x) + 0.4,
        Math.abs(westBox.min.x) + 0.4,
        Math.abs(westBox.max.x) + 0.4,
        4.1 / ratio,
      );
      camera.left = -halfWidth;
      camera.right = halfWidth;
      camera.top = halfWidth * ratio;
      camera.bottom = -halfWidth * ratio;
      camera.updateProjectionMatrix();
      shadows[0]!.position.x = east.root.position.x;
      shadows[1]!.position.x = west.root.position.x;
      fanPivot.rotation.z = input.winner === 'E' ? -0.75 : input.winner === 'W' ? 0.75 : 0;
      const now = performance.now();
      const animating = input.motion !== undefined && input.motion.time < input.motion.duration;
      const winnerChanged = previousWinner !== input.winner;
      previousWinner = input.winner;
      if (shouldRenderFrame(now, lastDrawAt, quality.maxFps, animating, winnerChanged)) {
        draw();
        // 残り時間を次へ持ち越し、60Hz画面でも30/45fpsの間隔を維持する。
        const interval = 1000 / quality.maxFps;
        lastDrawAt = Number.isFinite(lastDrawAt) ? now - ((now - lastDrawAt) % interval) : now;
      }
    };

    resize();
    update(initial);
    return {
      update,
      resize,
      metrics: () => ({
        frames,
        fps: frames > 1 ? ((frames - 1) * 1000) / (lastFrameAt - firstFrameAt) : 0,
        cpuMs: frames ? cpuTotal / frames : 0,
        calls: renderer.info.render.calls,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        pixelRatio: quality.pixelRatio,
      }),
      dispose: () => {
        if (disposed) return;
        disposed = true;
        dispose();
        shadowMaterial?.dispose();
        renderer.dispose();
        // renderer.dispose()だけではコンテキスト数制限に達する端末がある。
        // 閉じた取組のコンテキストを明示的に返却する。
        renderer.forceContextLoss();
      },
    };
  } catch (error) {
    shadowMaterial?.dispose();
    dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    throw error;
  }
}
