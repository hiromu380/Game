/**
 * 画像の読み込み（パーツ・盤面）（アセットマニフェスト → PixiJS のテクスチャ）
 *
 * SVG はそのまま拡大するとぼやけるため、表示サイズ × 画面密度で一度ラスタライズしてから使う。
 * 盤面の床・枠の素材も同じように読み込む。
 * PNG などの画像に差し替えても同じ処理で読み込める。
 */
import { PART_IDS, type PartId } from '@chain-factory/sim';
import { CanvasSource, Texture } from 'pixi.js';
import { BOARD_ASSETS, PART_ASSETS } from '../assets/manifest';
import { BOARD_PADDING, CELL_SIZE } from './layout';

export type PartTextures = Record<PartId, Texture>;

/** 画面密度（最低 2 倍で描いておく。拡大表示でもぼやけにくいように） */
const density = () => Math.max(2, window.devicePixelRatio || 1);

/**
 * 画像を読み込み、size×size（表示上の大きさ）× resolution のキャンバスへ描いてテクスチャにする。
 * テクスチャの大きさは表示上の大きさ（size）になる
 */
async function rasterize(src: string, size: number, resolution = 1): Promise<Texture> {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(size * resolution);
  canvas.height = Math.ceil(size * resolution);
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Texture({ source: new CanvasSource({ resource: canvas, resolution }) });
}

/** 盤面の素材のテクスチャ（床・使用不可マス・枠） */
export interface BoardTextures {
  floors: Texture[];
  blocked: Texture;
  frameCorner: Texture;
  frameEdge: Texture;
}

export async function loadBoardTextures(): Promise<BoardTextures> {
  const r = density();
  const [floors, blocked, frameCorner, frameEdge] = await Promise.all([
    Promise.all(BOARD_ASSETS.floors.map((src) => rasterize(src, CELL_SIZE, r))),
    rasterize(BOARD_ASSETS.blocked, CELL_SIZE, r),
    rasterize(BOARD_ASSETS.frameCorner, BOARD_PADDING, r),
    rasterize(BOARD_ASSETS.frameEdge, BOARD_PADDING, r),
  ]);
  return { floors, blocked, frameCorner, frameEdge };
}

/** 全パーツのテクスチャを読み込む。displaySize は盤面上での表示サイズ（px） */
export async function loadPartTextures(displaySize: number): Promise<PartTextures> {
  const pixelSize = Math.ceil(displaySize * density());
  const entries = await Promise.all(
    PART_IDS.map(async (id) => [id, await rasterize(PART_ASSETS[id].src, pixelSize)] as const),
  );
  return Object.fromEntries(entries) as PartTextures;
}
