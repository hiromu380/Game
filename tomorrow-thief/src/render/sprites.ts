/**
 * 人物・台・置物の絵（コードで描く仮素材。シルエット・光・素材の差を優先する）
 *
 * すべて足元（台は床の中心）を基準に描く。facing は画面上の向き
 */
import type { SymbolId } from '../core/slot';
import type { Vec } from '../core/types';
import { TILE_H, TILE_W, toScreen } from './iso';
import { PALETTE as C } from './palette';
import { FONT_BODY, FONT_TITLE } from '../fonts';

type Ctx = CanvasRenderingContext2D;

// -----------------------------------------------------------------------------
// 共通
// -----------------------------------------------------------------------------

function shadow(ctx: Ctx, w: number, h: number, color = 'rgba(0,0,0,0.38)') {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
}

function poly(ctx: Ctx, pts: number[], fill: string, stroke?: string, lw = 1.5) {
  ctx.beginPath();
  ctx.moveTo(pts[0]!, pts[1]!);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i]!, pts[i + 1]!);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

export interface FigureOpts {
  facing: Vec;
  /** 歩きの位相（ラジアン）。止まっていれば null */
  walk: number | null;
  alpha?: number;
  /** 残像などの単色の塗り（指定すると全体をこの色で描く） */
  tint?: string;
}

/** 向きで左右反転し、背中向きかを返す */
function orient(ctx: Ctx, facing: Vec): { back: boolean } {
  if (facing.x < -0.05) ctx.scale(-1, 1);
  return { back: facing.y < -0.2 };
}

// -----------------------------------------------------------------------------
// 主人公 リオ
// -----------------------------------------------------------------------------

export function drawRio(ctx: Ctx, x: number, y: number, o: FigureOpts & { watch: number; hurt?: boolean }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= o.alpha ?? 1;
  if (!o.tint) shadow(ctx, 18, 7);
  const { back } = orient(ctx, o.facing);
  const t = o.tint;
  const step = o.walk === null ? 0 : Math.sin(o.walk);
  const bob = o.walk === null ? 0 : Math.abs(Math.cos(o.walk)) * 2;
  ctx.translate(0, -bob);

  // 脚
  ctx.fillStyle = t ?? '#10131E';
  ctx.fillRect(-7, -22 + step * 2, 6, 22 - step * 2);
  ctx.fillRect(1, -22 - step * 2, 6, 22 + step * 2);
  ctx.fillStyle = t ?? '#2A1F18';
  ctx.fillRect(-8, -3 + Math.max(0, step) * 2, 8, 4);
  ctx.fillRect(0, -3 + Math.max(0, -step) * 2, 8, 4);

  // コート（短い濃紺）
  poly(ctx, [-13, -54, 13, -54, 17, -20, -17, -20], t ?? C.coat, t ? undefined : '#0E1426');
  if (!t) {
    poly(ctx, [-2, -54, 2, -54, 4, -22, -4, -22], back ? C.coat : '#2B3A60');
    ctx.fillStyle = C.brass;
    ctx.fillRect(-13, -33, 26, 2);
  }
  // 腕
  ctx.fillStyle = t ?? '#18223C';
  ctx.fillRect(-18, -52 - step, 6, 24);
  ctx.fillRect(12, -52 + step, 6, 24);
  ctx.fillStyle = t ?? C.skin;
  ctx.fillRect(-18, -29 - step, 6, 5);
  ctx.fillRect(12, -29 + step, 6, 5);

  // 銅色のスカーフ（なびく端）
  if (!back || !t) {
    poly(ctx, [-11, -57, 11, -57, 9, -50, -9, -50], t ?? C.copper);
    poly(ctx, [-9, -52, -20 - step * 2, -46, -18, -42, -6, -50], t ?? '#A8542C');
  }

  // 頭
  ctx.fillStyle = t ?? C.skin;
  ctx.beginPath();
  ctx.arc(0, -66, 10.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = t ?? C.hair;
  ctx.beginPath();
  if (back) {
    ctx.arc(0, -67, 11.2, 0, Math.PI * 2);
  } else {
    ctx.arc(0, -69, 11.2, Math.PI * 0.95, Math.PI * 2.05);
    ctx.lineTo(9, -63);
    ctx.lineTo(4, -68);
    ctx.lineTo(-3, -64);
    ctx.lineTo(-10, -62);
  }
  ctx.fill();
  if (!back && !t) {
    ctx.fillStyle = '#1B1B26';
    ctx.fillRect(1, -66, 2.2, 2.6);
    ctx.fillRect(6, -66, 2.2, 2.6);
  }

  // 左手の懐中時計（青緑の光）
  if (!t) {
    const wx = -15;
    const wy = -27;
    if (o.watch > 0) {
      const g = ctx.createRadialGradient(wx, wy, 1, wx, wy, 26 * o.watch + 6);
      g.addColorStop(0, 'rgba(85,222,228,0.75)');
      g.addColorStop(1, 'rgba(85,222,228,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(wx, wy, 26 * o.watch + 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = C.brass;
    ctx.beginPath();
    ctx.arc(wx, wy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = o.watch > 0 ? C.teal : C.ivory;
    ctx.beginPath();
    ctx.arc(wx, wy, 2.8, 0, Math.PI * 2);
    ctx.fill();
  }
  if (o.hurt && !t) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(227,90,95,0.45)';
    ctx.fillRect(-25, -80, 50, 82);
  }
  ctx.restore();
}

// -----------------------------------------------------------------------------
// 支配人 ミスター・ノクス
// -----------------------------------------------------------------------------

export function drawNox(ctx: Ctx, x: number, y: number, o: FigureOpts & { glow: number }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= o.alpha ?? 1;
  // 時間の外にいる存在感: 暗い赤の混ざった影
  shadow(ctx, 22, 8, 'rgba(70,10,18,0.55)');
  if (o.glow > 0) {
    const g = ctx.createRadialGradient(0, -60, 4, 0, -60, 90);
    g.addColorStop(0, `rgba(227,90,95,${0.25 * o.glow})`);
    g.addColorStop(1, 'rgba(227,90,95,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-90, -150, 180, 170);
  }
  const { back } = orient(ctx, o.facing);
  const step = o.walk === null ? 0 : Math.sin(o.walk);

  // 長い脚
  ctx.fillStyle = C.tailcoat;
  ctx.fillRect(-7, -48 + step * 2, 5, 48 - step * 2);
  ctx.fillRect(2, -48 - step * 2, 5, 48 + step * 2);
  ctx.fillStyle = '#050508';
  ctx.fillRect(-9, -3, 8, 3);
  ctx.fillRect(1, -3, 8, 3);

  // 燕尾服（後ろに伸びる燕尾）
  poly(ctx, [-6, -60, -22, -18 + step, -12, -26, -2, -46], '#08080C');
  poly(ctx, [6, -60, 20, -16 - step, 11, -26, 2, -46], '#08080C');
  poly(ctx, [-12, -104, 12, -104, 11, -52, -11, -52], C.tailcoat, '#22222E');
  if (!back) {
    // 胸元・ベスト・真鍮のチェーン
    poly(ctx, [-4, -104, 4, -104, 3, -60, -3, -60], '#EDE6DA');
    poly(ctx, [-8, -84, 8, -84, 7, -56, -7, -56], '#2A1218');
    ctx.strokeStyle = C.brass;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-6, -70);
    ctx.quadraticCurveTo(0, -62, 6, -72);
    ctx.stroke();
  }
  // 腕（動きは小さく）と白手袋
  ctx.fillStyle = C.tailcoat;
  ctx.fillRect(-16, -102, 5, 40);
  ctx.fillRect(11, -102, 5, 40);
  ctx.fillStyle = '#F4F1EA';
  ctx.fillRect(-16.5, -64, 6, 6);
  ctx.fillRect(10.5, -64, 6, 6);

  // 白磁の仮面
  ctx.fillStyle = back ? '#14141C' : C.ivory;
  ctx.beginPath();
  ctx.ellipse(0, -116, 9.5, 12.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (back) {
    ctx.strokeStyle = C.ivory;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-9, -116);
    ctx.lineTo(9, -116);
    ctx.stroke();
  } else {
    // 片目に金の秒針、もう片方に黒いガラス。口元は控えめな微笑
    ctx.fillStyle = '#0A0A10';
    ctx.beginPath();
    ctx.ellipse(4.2, -119, 2.6, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(-3.8, -119, 2.6, 0, Math.PI * 2);
    ctx.moveTo(-3.8, -119);
    ctx.lineTo(-3.8 + Math.cos(o.glow * 6) * 2.4, -119 + Math.sin(o.glow * 6) * 2.4);
    ctx.stroke();
    ctx.strokeStyle = '#8A7A6A';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -112, 3.5, 0.2 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();
  }
  // 撫でつけた髪
  ctx.fillStyle = '#050508';
  ctx.beginPath();
  ctx.ellipse(0, -126, 9, 4.5, 0, Math.PI, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// -----------------------------------------------------------------------------
// 警備
// -----------------------------------------------------------------------------

export function drawGuard(ctx: Ctx, x: number, y: number, o: FigureOpts & { alert: boolean; stunned: boolean }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= o.alpha ?? 1;
  const t = o.tint;
  if (!t) shadow(ctx, 17, 7);
  const { back } = orient(ctx, o.facing);
  const step = o.walk === null ? 0 : Math.sin(o.walk);
  ctx.fillStyle = t ?? '#1C1626';
  ctx.fillRect(-7, -24 + step * 2, 6, 24 - step * 2);
  ctx.fillRect(1, -24 - step * 2, 6, 24 + step * 2);
  poly(ctx, [-14, -58, 14, -58, 15, -22, -15, -22], t ?? C.guard, t ? undefined : C.guardDark);
  if (!t && !back) {
    ctx.fillStyle = C.oldGold;
    ctx.fillRect(-1, -56, 2, 32);
    ctx.beginPath();
    ctx.arc(-7, -48, 2.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = t ?? C.guardDark;
  ctx.fillRect(-19, -56, 6, 26);
  ctx.fillRect(13, -56, 6, 26);
  ctx.fillStyle = t ?? C.skin;
  ctx.beginPath();
  ctx.arc(0, -69, 10, 0, Math.PI * 2);
  ctx.fill();
  // 帽子（金の帯）
  poly(ctx, [-12, -74, 12, -74, 10, -84, -10, -84], t ?? C.guardDark);
  if (!t) {
    ctx.fillStyle = C.oldGold;
    ctx.fillRect(-12, -76, 24, 2.5);
    ctx.fillRect(-13, -74, 26 + (back ? 0 : 4), 2.5);
  }
  if (!t && o.alert) {
    ctx.fillStyle = C.red;
    ctx.font = `700 22px ${FONT_BODY}`;
    ctx.textAlign = 'center';
    ctx.scale(o.facing.x < -0.05 ? -1 : 1, 1);
    ctx.fillText('!', 0, -92);
  }
  if (!t && o.stunned) {
    ctx.strokeStyle = C.teal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -90, 12, 4, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawBouncer(ctx: Ctx, x: number, y: number, o: FigureOpts & { alert: boolean; stunned: boolean }) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= o.alpha ?? 1;
  const t = o.tint;
  if (!t) shadow(ctx, 24, 9);
  const { back } = orient(ctx, o.facing);
  const step = o.walk === null ? 0 : Math.sin(o.walk);
  ctx.fillStyle = t ?? '#0D0C12';
  ctx.fillRect(-11, -28 + step * 2, 9, 28 - step * 2);
  ctx.fillRect(2, -28 - step * 2, 9, 28 + step * 2);
  poly(ctx, [-24, -72, 24, -72, 20, -24, -20, -24], t ?? C.bouncer, t ? undefined : '#0D0C12');
  if (!t && !back) {
    poly(ctx, [-5, -72, 5, -72, 0, -50], '#EDE6DA');
    poly(ctx, [-2, -68, 2, -68, 3, -46, 0, -42, -3, -46], C.gold);
  }
  ctx.fillStyle = t ?? '#1A1820';
  ctx.fillRect(-30, -70, 9, 34);
  ctx.fillRect(21, -70, 9, 34);
  ctx.fillStyle = t ?? '#C9A88A';
  ctx.beginPath();
  ctx.arc(0, -82, 11, 0, Math.PI * 2);
  ctx.fill();
  if (!t && !back) {
    ctx.fillStyle = '#111';
    ctx.fillRect(-7, -85, 14, 3.5);
  }
  if (!t && o.alert) {
    ctx.fillStyle = C.red;
    ctx.font = `700 24px ${FONT_BODY}`;
    ctx.textAlign = 'center';
    ctx.scale(o.facing.x < -0.05 ? -1 : 1, 1);
    ctx.fillText('!', 0, -102);
  }
  if (!t && o.stunned) {
    ctx.strokeStyle = C.teal;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -102, 14, 4.5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

// -----------------------------------------------------------------------------
// 絵柄
// -----------------------------------------------------------------------------

export function drawSymbol(ctx: Ctx, sym: SymbolId, cx: number, cy: number, size: number) {
  ctx.save();
  ctx.translate(cx, cy);
  const s = size / 40;
  ctx.scale(s, s);
  switch (sym) {
    case 'seven':
      ctx.font = `700 38px ${FONT_TITLE}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#5A1015';
      ctx.strokeText('7', 0, 2);
      ctx.fillStyle = C.red;
      ctx.fillText('7', 0, 2);
      break;
    case 'bar':
      for (const yy of [-9, 0, 9]) {
        ctx.fillStyle = C.oldGold;
        ctx.fillRect(-15, yy - 3, 30, 6);
      }
      ctx.fillStyle = C.navy;
      ctx.font = `700 9px ${FONT_BODY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('BAR', 0, 0.5);
      break;
    case 'bell':
      ctx.fillStyle = C.gold;
      ctx.beginPath();
      ctx.moveTo(-13, 10);
      ctx.quadraticCurveTo(-12, -14, 0, -15);
      ctx.quadraticCurveTo(12, -14, 13, 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = C.brassDark;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = C.brassDark;
      ctx.beginPath();
      ctx.arc(0, 12, 3.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'cherry':
      ctx.strokeStyle = '#3E6B3A';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-7, 4);
      ctx.quadraticCurveTo(-2, -12, 6, -15);
      ctx.moveTo(8, 6);
      ctx.quadraticCurveTo(6, -8, 6, -15);
      ctx.stroke();
      ctx.fillStyle = '#B4232F';
      for (const [xx, yy] of [
        [-8, 8],
        [8, 9],
      ]) {
        ctx.beginPath();
        ctx.arc(xx!, yy!, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case 'clock':
      ctx.fillStyle = C.ivory;
      ctx.strokeStyle = C.brass;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = C.navy;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -10);
      ctx.moveTo(0, 0);
      ctx.lineTo(7, 3);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

const SYMBOL_STRIP: SymbolId[] = ['seven', 'cherry', 'bell', 'clock', 'bar', 'cherry', 'bell', 'clock'];

/**
 * リールの窓（3つ）。spin は回転量（リールが流れる。負なら逆回転）。
 * reels が null で回っていなければ空の窓
 */
export function drawReelWindow(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  reels: readonly SymbolId[] | null,
  spin: number[] | null,
) {
  const cell = w / 3;
  for (let i = 0; i < 3; i++) {
    const cx = x + cell * i;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx + 2, y + 2, cell - 4, h - 4);
    ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, '#BDB6A8');
    g.addColorStop(0.3, C.milkGlass);
    g.addColorStop(0.7, C.milkGlass);
    g.addColorStop(1, '#BDB6A8');
    ctx.fillStyle = g;
    ctx.fillRect(cx, y, cell, h);
    const size = Math.min(cell, h) * 0.78;
    const rot = spin?.[i];
    if (rot !== undefined && rot !== null && Number.isFinite(rot)) {
      // 流れる絵柄
      const off = ((rot % 1) + 1) % 1;
      const base = Math.floor(rot);
      for (let k = -1; k <= 1; k++) {
        const sym = SYMBOL_STRIP[(((base + k) % SYMBOL_STRIP.length) + SYMBOL_STRIP.length) % SYMBOL_STRIP.length]!;
        drawSymbol(ctx, sym, cx + cell / 2, y + h / 2 + (k + off) * h * 0.8, size);
      }
    } else if (reels) {
      drawSymbol(ctx, reels[i]!, cx + cell / 2, y + h / 2, size);
    }
    ctx.restore();
    ctx.strokeStyle = C.brass;
    ctx.lineWidth = 2;
    ctx.strokeRect(cx + 1.5, y + 1.5, cell - 3, h - 3);
  }
}

// -----------------------------------------------------------------------------
// 台（等角の筐体）
// -----------------------------------------------------------------------------

export interface MachineLook {
  /** 窓のある面: s（手前左）/ e（手前右） */
  face: 's' | 'e';
  /** 筐体の光る場所: 通常 / 予知済み（青緑） / 当たり（明るい金） / 故障 */
  state: 'idle' | 'predicted' | 'win' | 'broken' | 'dead';
  /** レバーの引き具合（0〜1） */
  lever: number;
  highlight: boolean;
  time: number;
}

const MACHINE_H = 128;

function faceTransform(ctx: Ctx, p0: Vec, p1: Vec, width: number) {
  ctx.transform((p1.x - p0.x) / width, (p1.y - p0.y) / width, 0, 1, p0.x, p0.y);
}

export function drawMachine(ctx: Ctx, mx: number, my: number, look: MachineLook) {
  const inset = 0.12;
  const A = toScreen(mx + inset, my + inset);
  const B = toScreen(mx + 1 - inset, my + inset);
  const Cc = toScreen(mx + 1 - inset, my + 1 - inset);
  const D = toScreen(mx + inset, my + 1 - inset);
  const up = (p: Vec, h: number) => ({ x: p.x, y: p.y - h });
  const H = MACHINE_H;
  const glow =
    look.state === 'predicted' ? C.teal : look.state === 'win' ? C.gold : look.state === 'broken' ? C.red : null;

  // 床の光（状態の色）
  if (glow) {
    const center = toScreen(mx + 0.5, my + 0.5);
    ctx.save();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(look.time * 3);
    const g = ctx.createRadialGradient(center.x, center.y, 4, center.x, center.y, TILE_W * 0.8);
    g.addColorStop(0, glow);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y, TILE_W * 0.8, TILE_H * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const dim = look.state === 'dead' ? 0.55 : 1;
  ctx.save();
  ctx.globalAlpha *= dim;
  // 側面（黒い大理石の台座 + 筐体）
  const leftFace = [D, Cc, up(Cc, H), up(D, H)];
  const rightFace = [Cc, B, up(B, H), up(Cc, H)];
  const fillFace = (pts: Vec[], color: string) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  fillFace(leftFace, '#20263A');
  fillFace(rightFace, '#161B2B');
  // 上面
  fillFace([up(A, H), up(B, H), up(Cc, H), up(D, H)], '#2C3350');

  // 窓のある面に、真鍮の縁・乳白色のガラス・時計の弧の飾り
  const [p0, p1] = look.face === 's' ? [D, Cc] : [Cc, B];
  const L = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  ctx.save();
  faceTransform(ctx, p0, p1, L);
  // 台座の金の帯
  ctx.fillStyle = C.brassDark;
  ctx.fillRect(0, -34, L, 4);
  ctx.fillStyle = C.oldGold;
  ctx.fillRect(0, -H + 6, L, 3);
  // 払い出し口
  ctx.fillStyle = '#0B0E18';
  ctx.fillRect(L * 0.22, -26, L * 0.56, 12);
  ctx.strokeStyle = C.brass;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(L * 0.22, -26, L * 0.56, 12);
  // リールの窓（小）
  ctx.fillStyle = C.brass;
  ctx.fillRect(L * 0.08, -92, L * 0.84, 34);
  ctx.fillStyle = C.milkGlass;
  ctx.fillRect(L * 0.12, -89, L * 0.76, 28);
  ctx.fillStyle = 'rgba(20,26,43,0.25)';
  ctx.fillRect(L * 0.37, -89, 1.5, 28);
  ctx.fillRect(L * 0.63, -89, 1.5, 28);
  // 光る場所（窓の上の弧と、縁のランプ）
  const lamp = glow ?? C.oldGold;
  ctx.fillStyle = lamp;
  ctx.globalAlpha *= glow ? 0.95 : 0.6;
  ctx.beginPath();
  ctx.arc(L / 2, -100, L * 0.3, Math.PI, 0);
  ctx.lineTo(L * 0.5 + L * 0.3, -100);
  ctx.fill();
  ctx.globalAlpha /= glow ? 0.95 : 0.6;
  ctx.strokeStyle = C.brassDark;
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 6; i++) {
    const a = Math.PI + (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(L / 2, -100);
    ctx.lineTo(L / 2 + Math.cos(a) * L * 0.3, -100 + Math.sin(a) * L * 0.3);
    ctx.stroke();
  }
  ctx.restore();

  // レバー（窓の右側の面から突き出す）
  const leverBase = look.face === 's' ? up(Cc, 80) : up(B, 80);
  const pull = look.lever;
  const tip = { x: leverBase.x + 10, y: leverBase.y - 34 + pull * 44 };
  ctx.strokeStyle = C.brass;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(leverBase.x, leverBase.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();
  ctx.fillStyle = look.state === 'win' ? C.gold : C.red;
  ctx.beginPath();
  ctx.arc(tip.x, tip.y, 6, 0, Math.PI * 2);
  ctx.fill();

  // 縁取り
  ctx.strokeStyle = look.highlight ? C.gold : C.brassDark;
  ctx.lineWidth = look.highlight ? 2.5 : 1.2;
  ctx.beginPath();
  for (const pts of [leftFace, rightFace]) {
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
  }
  ctx.stroke();

  if (look.state === 'broken' || look.state === 'dead') {
    // ひび割れ
    const c0 = up(look.face === 's' ? D : Cc, 70);
    ctx.strokeStyle = look.state === 'broken' ? C.red : '#6A6A7A';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(c0.x + 8, c0.y - 10);
    ctx.lineTo(c0.x + 16, c0.y + 2);
    ctx.lineTo(c0.x + 12, c0.y + 8);
    ctx.lineTo(c0.x + 22, c0.y + 20);
    ctx.stroke();
  }
  ctx.restore();
}

export const MACHINE_TOP = MACHINE_H;

// -----------------------------------------------------------------------------
// 置物
// -----------------------------------------------------------------------------

function isoBox(ctx: Ctx, x: number, y: number, h: number, colors: { left: string; right: string; top: string }, inset = 0.06) {
  const A = toScreen(x + inset, y + inset);
  const B = toScreen(x + 1 - inset, y + inset);
  const Cc = toScreen(x + 1 - inset, y + 1 - inset);
  const D = toScreen(x + inset, y + 1 - inset);
  const up = (p: Vec) => ({ x: p.x, y: p.y - h });
  const face = (pts: Vec[], color: string) => {
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };
  face([D, Cc, up(Cc), up(D)], colors.left);
  face([Cc, B, up(B), up(Cc)], colors.right);
  face([up(A), up(B), up(Cc), up(D)], colors.top);
  return { A, B, C: Cc, D, up };
}

export function drawCounter(ctx: Ctx, x: number, y: number, kind: 'shop' | 'exit', time: number) {
  const box = isoBox(ctx, x, y, 46, {
    left: kind === 'shop' ? '#3A2A20' : '#20263A',
    right: kind === 'shop' ? '#2A1E16' : '#161B2B',
    top: kind === 'shop' ? '#5A4430' : '#2C3350',
  });
  ctx.strokeStyle = C.oldGold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(box.up(box.D).x, box.up(box.D).y + 6);
  ctx.lineTo(box.up(box.C).x, box.up(box.C).y + 6);
  ctx.lineTo(box.up(box.B).x, box.up(box.B).y + 6);
  ctx.stroke();
  const top = box.up(toScreen(x + 0.5, y + 0.5));
  if (kind === 'shop') {
    // 置き時計と歯車
    ctx.fillStyle = C.brass;
    ctx.beginPath();
    ctx.arc(top.x, top.y - 12, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.ivory;
    ctx.beginPath();
    ctx.arc(top.x, top.y - 12, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.navy;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(top.x, top.y - 12);
    ctx.lineTo(top.x + Math.cos(time) * 5, top.y - 12 + Math.sin(time) * 5);
    ctx.stroke();
  } else {
    // 金の封筒と小さな時計
    ctx.fillStyle = C.oldGold;
    ctx.fillRect(top.x - 12, top.y - 10, 24, 14);
    ctx.strokeStyle = C.brassDark;
    ctx.beginPath();
    ctx.moveTo(top.x - 12, top.y - 10);
    ctx.lineTo(top.x, top.y - 2);
    ctx.lineTo(top.x + 12, top.y - 10);
    ctx.stroke();
  }
}

/** アールデコの柱（手前の柱は、主人公が隠れるときに半透明にする） */
export function drawPillar(ctx: Ctx, x: number, y: number, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  const h = 230;
  const box = isoBox(ctx, x + 0.2, y + 0.2, h, { left: '#151A28', right: '#0E1220', top: '#2A3048' }, 0.2);
  // 金の柱頭と縦の溝
  ctx.strokeStyle = C.oldGold;
  ctx.lineWidth = 2;
  for (const k of [0.3, 0.5, 0.7]) {
    const a = { x: box.D.x + (box.C.x - box.D.x) * k, y: box.D.y + (box.C.y - box.D.y) * k };
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - 20);
    ctx.lineTo(a.x, a.y - h + 30);
    ctx.stroke();
  }
  ctx.fillStyle = C.oldGold;
  ctx.beginPath();
  const cTop = box.up(box.C);
  ctx.moveTo(box.up(box.D).x - 4, box.up(box.D).y + 10);
  ctx.lineTo(cTop.x, cTop.y + 14);
  ctx.lineTo(box.up(box.B).x + 4, box.up(box.B).y + 10);
  ctx.lineTo(box.up(box.B).x, box.up(box.B).y + 2);
  ctx.lineTo(cTop.x, cTop.y + 6);
  ctx.lineTo(box.up(box.D).x, box.up(box.D).y + 2);
  ctx.fill();
  ctx.restore();
}
