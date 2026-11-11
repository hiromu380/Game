/**
 * 小さなドットの画布（純粋関数。Canvas を使わない）: 色を置き、最後に墨の輪郭を回して RGBA にする
 * 箱庭の人（art/hakoniwa/people.ts）と顔の絵（art/pixel/portrait.ts）で共有する
 */
import { PALETTE } from '../palette';

export interface Pixels {
  width: number;
  height: number;
  /** RGBA（幅 × 高さ × 4） */
  data: Uint8ClampedArray;
}

export type Rgb = readonly [number, number, number];

export function rgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
export function dark(c: Rgb, k = 0.78): Rgb {
  return [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k)];
}

export const SUMI = rgb(PALETTE.sumi);

/** 色を置き、最後に墨の輪郭を回す */
export class Sheet {
  private readonly c: (Rgb | null)[];
  /** これから置く色を、下へずらすドット数（絵の上に余白を取る） */
  oy = 0;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.c = new Array<Rgb | null>(this.w * this.h).fill(null);
  }
  at(x: number, y: number): Rgb | null {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? (this.c[y * this.w + x] ?? null) : null;
  }
  px(x: number, y: number, col: Rgb): void {
    x = Math.round(x);
    y = Math.round(y) + this.oy;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.c[y * this.w + x] = col;
  }
  rect(x: number, y: number, w: number, h: number, col: Rgb): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, col);
  }
  /** だ円。右下に1段の陰（版画の明暗） */
  ball(cx: number, cy: number, rx: number, ry: number, col: Rgb, shade = true): void {
    const inside = (x: number, y: number, ox: number, oy: number) =>
      ((x - cx - ox) / rx) ** 2 + ((y - cy - oy) / ry) ** 2 <= 1;
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        if (!inside(x, y, 0, 0)) continue;
        this.px(x, y, shade && !inside(x, y, -1.2, -1.2) ? dark(col) : col);
      }
  }
  /** 太さのある線（腕・脚） */
  limb(x0: number, y0: number, x1: number, y1: number, r: number, col: Rgb): void {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++)
      this.ball(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, r, r, col, false);
  }
  /** すでに色のある所だけ塗る（まわしを体の形に沿わせる） */
  over(x: number, y: number, w: number, h: number, col: Rgb): void {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const xx = Math.round(x + i);
        const yy = Math.round(y + j) + this.oy;
        if (xx >= 0 && yy >= 0 && xx < this.w && yy < this.h && this.c[yy * this.w + xx])
          this.c[yy * this.w + xx] = col;
      }
  }
  out(flip: boolean): Pixels {
    const data = new Uint8ClampedArray(this.w * this.h * 4);
    const at = (x: number, y: number) => this.at(x, y);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        let col = at(x, y) ?? null;
        // 色のない所で、隣（上下左右）に色があれば輪郭
        if (!col && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) col = SUMI;
        if (!col) continue;
        const o = (y * this.w + (flip ? this.w - 1 - x : x)) * 4;
        data[o] = col[0];
        data[o + 1] = col[1];
        data[o + 2] = col[2];
        data[o + 3] = 255;
      }
    return { width: this.w, height: this.h, data };
  }
}
