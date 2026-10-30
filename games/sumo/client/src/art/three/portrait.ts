/**
 * 3D力士を静止画として取り出す。表示中の肖像ごとにWebGLコンテキストを作らない。
 * 背景・陰影・輪郭線は生成素材を使わずコードだけで組み立てる。
 */
import * as THREE from 'three';
import type { Look } from '../look';
import { PALETTE } from '../palette';
import { createIllustrator } from './figure3d';
import { portraitKey, type PortraitVariant } from '../portraitKey';

const MAX_PORTRAITS = 64;
const CACHE = new Map<string, string>();
let renderer: THREE.WebGLRenderer | null = null;

function sharedRenderer(): THREE.WebGLRenderer {
  if (!renderer) {
    // preserveDrawingBufferにより描画直後の静止画を読み取り、1つのGPUコンテキストを使い回す。
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: 'low-power',
    });
    renderer.setPixelRatio(1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    const activeRenderer = renderer;
    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      if (renderer === activeRenderer) {
        activeRenderer.dispose();
        renderer = null;
        CACHE.clear();
      }
    });
  }
  return renderer;
}

/** キャッシュ済みならGPU処理を一切行わない。失敗した場合は呼び出し元でSVGに戻す。 */
export function renderPortrait(look: Look, variant: PortraitVariant): string {
  const key = portraitKey(look, variant);
  const cached = CACHE.get(key);
  if (cached) {
    // 最近表示した肖像を後ろへ移し、古いものから破棄する。
    CACHE.delete(key);
    CACHE.set(key, cached);
    return cached;
  }

  const gpu = sharedRenderer();
  const pixels = variant === 'bust' ? 256 : 320;
  gpu.setSize(pixels, pixels, false);
  gpu.setClearColor(PALETTE.washi, 0);

  const scene = new THREE.Scene();
  const half = variant === 'bust' ? 0.91 : 1.9;
  const center = variant === 'bust' ? 2.19 : 1.54;
  const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 20);
  camera.position.set(0, center + 0.13, 8);
  camera.lookAt(0, center, 0);
  scene.add(new THREE.AmbientLight(PALETTE.white, 1.1));
  const light = new THREE.DirectionalLight(PALETTE.white, 0.55);
  light.position.set(-3, 5, 7);
  scene.add(light);

  const illustrator = createIllustrator();
  try {
    const puppet = illustrator.createWrestler(look, scene);
    puppet.root.rotation.y = -0.11;
    gpu.render(scene, camera);
    // WebP非対応の環境ではブラウザがPNGへ自動フォールバックする。
    const url = gpu.domElement.toDataURL('image/webp', 0.94);
    if (CACHE.size >= MAX_PORTRAITS) {
      const first = CACHE.keys().next().value;
      if (first) CACHE.delete(first);
    }
    CACHE.set(key, url);
    return url;
  } finally {
    illustrator.dispose();
    scene.clear();
  }
}
