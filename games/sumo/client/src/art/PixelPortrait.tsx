/**
 * 顔の絵（ドット絵）を画像にして出す。同じ見た目は1回だけ画像にして使い回す。
 * 整数倍に拡大した画像を作り、表示の大きさへはブラウザに縮めさせる（半端な倍率でもドットの大きさがそろう）
 */
import { useMemo } from 'react';
import type { Look } from './look';
import { PORTRAIT, portraitKey, portraitPixels, type PortraitVariant } from './pixel/portrait';

/** 画像にするときの倍率 */
const SCALE = 6;
const urls = new Map<string, string>();

function urlOf(look: Look, variant: PortraitVariant): string | null {
  const key = portraitKey(look, variant);
  const hit = urls.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined') return null;
  const px = portraitPixels(look, variant);
  const small = document.createElement('canvas');
  small.width = px.width;
  small.height = px.height;
  const sctx = small.getContext('2d');
  if (!sctx) return null;
  const img = sctx.createImageData(px.width, px.height);
  img.data.set(px.data);
  sctx.putImageData(img, 0, 0);
  const big = document.createElement('canvas');
  big.width = px.width * SCALE;
  big.height = px.height * SCALE;
  const bctx = big.getContext('2d');
  if (!bctx) return null;
  bctx.imageSmoothingEnabled = false;
  bctx.drawImage(small, 0, 0, big.width, big.height);
  const url = big.toDataURL('image/png');
  urls.set(key, url);
  return url;
}

export function PixelPortrait({
  look,
  variant = 'bust',
  size = 72,
}: {
  look: Look;
  variant?: PortraitVariant;
  /** 幅（px か CSS の長さ）。高さは絵の縦横比で決まる */
  size?: number | string;
}) {
  const key = portraitKey(look, variant);
  // look は毎回作り直されるので、鍵（中身）で比べる
  const url = useMemo(() => urlOf(look, variant), [key]);
  const dim = PORTRAIT[variant];
  return (
    <span
      className={`portrait portrait--${variant}`}
      style={{ width: size, aspectRatio: `${dim.width} / ${dim.height}` }}
      aria-hidden="true"
    >
      {url && <img src={url} alt="" width={dim.width * SCALE} height={dim.height * SCALE} />}
    </span>
  );
}
