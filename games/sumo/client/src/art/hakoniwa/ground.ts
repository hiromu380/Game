/**
 * 箱庭の地面・塀・道をドットで描く（Canvas。にじませないよう1ドットずつの帯で塗る）
 */
import { PALETTE } from '../palette';
import { toScreen, TILE_H, TILE_W } from './grid';
import { GATE, PATH, PLOT, STREET, type Season } from './compound';

type Ctx = CanvasRenderingContext2D;

/** 色を暗く（版画の陰は 0.78） */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = [n >> 16, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(v * k))),
  );
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/** マス目ごとに決まる小さなばらつき（0〜1。乱数を使わない） */
function hash(gx: number, gy: number): number {
  const h = Math.imul((gx * 73856093) ^ (gy * 19349663), 2654435761) >>> 0;
  return (h % 1000) / 1000;
}

/** 1マスのひし形を塗る（inset で内側に縮める） */
function diamond(ctx: Ctx, gx: number, gy: number, color: string, inset = 0): void {
  const { x, y } = toScreen(gx, gy);
  ctx.fillStyle = color;
  for (let r = inset; r < TILE_H - inset; r++) {
    const hw = (r < TILE_H / 2 ? r + 1 : TILE_H - r) * 2 - inset * 2;
    if (hw > 0) ctx.fillRect(Math.round(x - hw), Math.round(y + r), hw * 2, 1);
  }
}

/** 斜めの線にそって、縦の帯で塀を立てる。from → to は塀の足元（画面のドット） */
function wall(
  ctx: Ctx,
  from: { x: number; y: number },
  to: { x: number; y: number },
  lit: boolean,
): void {
  const height = 26;
  const k = lit ? 1 : 0.78;
  const x0 = Math.round(Math.min(from.x, to.x));
  const x1 = Math.round(Math.max(from.x, to.x));
  for (let x = x0; x <= x1; x++) {
    const t = (x - from.x) / (to.x - from.x || 1);
    const base = Math.round(from.y + (to.y - from.y) * t);
    const top = base - height;
    const post = (x - x0) % TILE_W < 2 || x === x1;
    // 瓦の笠・板・漆喰の腰・土台
    ctx.fillStyle = PALETTE.sumi;
    ctx.fillRect(x, top - 1, 1, 1);
    ctx.fillStyle = shade(PALETTE.tileDark, k);
    ctx.fillRect(x, top, 1, 3);
    ctx.fillStyle = shade(PALETTE.tile, k);
    ctx.fillRect(x, top + 3, 1, 1);
    ctx.fillStyle = shade(
      post ? PALETTE.woodDark : (x - x0) % 6 === 0 ? PALETTE.woodDark : PALETTE.wood,
      k,
    );
    ctx.fillRect(x, top + 4, 1, height - 12);
    ctx.fillStyle = shade(PALETTE.plaster, k);
    ctx.fillRect(x, base - 8, 1, 7);
    ctx.fillStyle = PALETTE.sumi;
    ctx.fillRect(x, base - 1, 1, 1);
  }
}

/** 手前の低い縁石（敷地と道・外のさかい） */
function curb(ctx: Ctx, from: { x: number; y: number }, to: { x: number; y: number }): void {
  const x0 = Math.round(Math.min(from.x, to.x));
  const x1 = Math.round(Math.max(from.x, to.x));
  for (let x = x0; x <= x1; x++) {
    const t = (x - from.x) / (to.x - from.x || 1);
    const base = Math.round(from.y + (to.y - from.y) * t);
    ctx.fillStyle = PALETTE.stone;
    ctx.fillRect(x, base - 2, 1, 2);
    ctx.fillStyle = shade(PALETTE.stone, 0.7);
    ctx.fillRect(x, base, 1, 1);
  }
}

/** 地面のはば（描く範囲のマス）。道と、まわりの草地を含む */
export const GROUND = { gx0: -12, gy0: -12, gx1: PLOT.w + 12, gy1: PLOT.d + STREET + 12 } as const;

export function drawGround(ctx: Ctx, season: Season): void {
  const path = new Set(PATH.map(([x, y]) => `${x},${y}`));
  const snow = season === 'winter';
  for (let gy = GROUND.gy0; gy < GROUND.gy1; gy++) {
    for (let gx = GROUND.gx0; gx < GROUND.gx1; gx++) {
      const v = hash(gx, gy);
      const inPlot = gx >= 0 && gx < PLOT.w && gy >= 0 && gy < PLOT.d;
      const street = gy >= PLOT.d && gy < PLOT.d + STREET && gx >= GROUND.gx0;
      if (inPlot) {
        // 庭の土（少しまだら）。冬はうっすら雪
        diamond(ctx, gx, gy, shade(PALETTE.earth, v < 0.3 ? 0.95 : 1));
        if (snow && v < 0.5) diamond(ctx, gx, gy, PALETTE.snow, 5);
        if (path.has(`${gx},${gy}`)) {
          diamond(ctx, gx, gy, shade(PALETTE.stone, 0.75), 1);
          diamond(ctx, gx, gy, PALETTE.stone, 2);
        }
      } else if (street) {
        diamond(ctx, gx, gy, shade(PALETTE.earth, v < 0.4 ? 0.82 : 0.86));
      } else {
        diamond(ctx, gx, gy, shade(PALETTE.grass, v < 0.3 ? 0.9 : 1));
        if (v > 0.8) diamond(ctx, gx, gy, PALETTE.foliage, 6);
      }
    }
  }
  // 奥の2辺の塀（右上の辺は日が当たる、左上の辺は陰）
  wall(ctx, toScreen(0, 0), toScreen(0, PLOT.d), false);
  wall(ctx, toScreen(0, 0), toScreen(PLOT.w, 0), true);
  // 手前の縁石（門のところはあける）
  curb(ctx, toScreen(0, PLOT.d), toScreen(GATE.gx, PLOT.d));
  curb(ctx, toScreen(GATE.gx + GATE.w, PLOT.d), toScreen(PLOT.w, PLOT.d));
  curb(ctx, toScreen(PLOT.w, 0), toScreen(PLOT.w, PLOT.d));
}

/** 地面の画面上の外枠（描く範囲） */
export function groundBounds(): { x0: number; y0: number; x1: number; y1: number } {
  const corners = [
    toScreen(GROUND.gx0, GROUND.gy0),
    toScreen(GROUND.gx1, GROUND.gy0),
    toScreen(GROUND.gx0, GROUND.gy1),
    toScreen(GROUND.gx1, GROUND.gy1),
  ];
  return {
    x0: Math.min(...corners.map((c) => c.x)) - TILE_W / 2,
    y0: Math.min(...corners.map((c) => c.y)) - 30,
    x1: Math.max(...corners.map((c) => c.x)) + TILE_W / 2,
    y1: Math.max(...corners.map((c) => c.y)) + TILE_H,
  };
}
