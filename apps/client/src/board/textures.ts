/**
 * パーツ画像の読み込み（アセットマニフェスト → PixiJS のテクスチャ）
 *
 * SVG はそのまま拡大するとぼやけるため、表示サイズ × 画面密度で一度ラスタライズしてから使う。
 * PNG などの画像に差し替えても同じ処理で読み込める。
 */
import { PART_IDS, type PartId } from '@chain-factory/sim';
import { Texture } from 'pixi.js';
import { PART_ASSETS } from '../assets/manifest';

export type PartTextures = Record<PartId, Texture>;

/** 画像を読み込み、size×size のキャンバスへ描いてテクスチャにする */
async function rasterize(src: string, size: number): Promise<Texture> {
  const image = new Image();
  image.src = src;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d')?.drawImage(image, 0, 0, size, size);
  return Texture.from(canvas);
}

/** 全パーツのテクスチャを読み込む。displaySize は盤面上での表示サイズ（px） */
export async function loadPartTextures(displaySize: number): Promise<PartTextures> {
  const pixelSize = Math.ceil(displaySize * Math.max(2, window.devicePixelRatio || 1));
  const entries = await Promise.all(
    PART_IDS.map(async (id) => [id, await rasterize(PART_ASSETS[id].src, pixelSize)] as const),
  );
  return Object.fromEntries(entries) as PartTextures;
}
