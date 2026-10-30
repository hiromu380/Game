/**
 * 画面密度と描画面積から3D表示の負荷を決定する純粋関数。
 * 小さな画面はテカリや過剰なアンチエイリアスより、墨線の読みやすさを優先する。
 */
export interface RenderQuality {
  pixelRatio: number;
  maxFps: number;
  maxPixels: number;
}

/** GPUバッファを上限内に保つ。CSSピクセルは一切変更しない。 */
export function chooseRenderQuality(
  width: number,
  height: number,
  devicePixelRatio: number,
  coarsePointer: boolean,
): RenderQuality {
  const w = Number.isFinite(width) ? Math.max(1, width) : 1;
  const h = Number.isFinite(height) ? Math.max(1, height) : 1;
  const device = Number.isFinite(devicePixelRatio) ? Math.max(0.5, devicePixelRatio) : 1;
  const maxPixels = coarsePointer ? 480_000 : 1_350_000;
  const maximumRatio = coarsePointer ? 1.3 : 1.5;
  const pixelRatio = Math.min(device, maximumRatio, Math.sqrt(maxPixels / (w * h)));
  return {
    pixelRatio,
    maxFps: coarsePointer ? 30 : 45,
    maxPixels,
  };
}

/** 終了場面や勝者決定を間引かず、移動中のGPU描画だけを抑える。 */
export function shouldRenderFrame(
  now: number,
  lastAt: number,
  fps: number,
  animating: boolean,
  winnerChanged: boolean,
): boolean {
  if (!animating || winnerChanged) return true;
  if (!Number.isFinite(now) || !Number.isFinite(lastAt)) return true;
  return now - lastAt >= 1000 / Math.max(1, fps);
}
