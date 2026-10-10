/**
 * 部屋の背景（壁・床・扉）。動かない部分は部屋ごとに一度だけ描いて使い回す
 *
 * 装飾（時計の弧・放射状の線・階段状の模様）は壁と周縁に集め、歩く床は見やすく保つ
 */
import type { Door, Room } from '../core/types';
import { TEXT } from '../strings';
import { SCREEN_H, SCREEN_W, TILE_H, TILE_W, WALL_H, toScreen } from './iso';
import { PALETTE as C } from './palette';
import { FONT_TITLE } from '../fonts';

type Ctx = CanvasRenderingContext2D;

const cache = new Map<string, HTMLCanvasElement>();

export function roomBackground(room: Room, rooms: Record<string, Room>): HTMLCanvasElement {
  const key = room.id;
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = SCREEN_W;
  canvas.height = SCREEN_H;
  const ctx = canvas.getContext('2d')!;
  drawBackdrop(ctx);
  drawWalls(ctx, room, rooms);
  drawFloor(ctx, room);
  cache.set(key, canvas);
  return canvas;
}

export function clearRoomCache() {
  cache.clear();
}

function drawBackdrop(ctx: Ctx) {
  const g = ctx.createRadialGradient(SCREEN_W / 2, SCREEN_H * 0.45, 100, SCREEN_W / 2, SCREEN_H * 0.5, SCREEN_W * 0.7);
  g.addColorStop(0, '#1C2238');
  g.addColorStop(1, C.navyDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
  // 天井の放射状の線（金）
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = C.oldGold;
  ctx.lineWidth = 2;
  const cx = SCREEN_W / 2;
  for (let i = 0; i <= 24; i++) {
    const a = Math.PI + (i * Math.PI) / 24;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx + Math.cos(a) * 1400, -Math.sin(a) * 1400 * -1);
    ctx.stroke();
  }
  ctx.restore();
}

function quad(ctx: Ctx, pts: { x: number; y: number }[], fill: string | CanvasGradient) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

/** 壁の面の座標系: u は壁に沿った位置（タイル）、v は高さ（px） */
function wallPoint(side: 'n' | 'w', room: Room, u: number, v: number) {
  const p = side === 'n' ? toScreen(u, 0) : toScreen(0, room.height - u);
  return { x: p.x, y: p.y - v };
}

function drawWalls(ctx: Ctx, room: Room, rooms: Record<string, Room>) {
  for (const side of ['w', 'n'] as const) {
    const len = side === 'n' ? room.width : room.height;
    const p = (u: number, v: number) => wallPoint(side, room, u, v);
    // 黒い大理石
    const g = ctx.createLinearGradient(0, p(0, WALL_H).y, 0, p(0, 0).y);
    g.addColorStop(0, side === 'n' ? '#161B2A' : '#121624');
    g.addColorStop(1, side === 'n' ? '#222A40' : '#1B2134');
    quad(ctx, [p(0, 0), p(len, 0), p(len, WALL_H), p(0, WALL_H)], g);
    // 大理石の筋
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.strokeStyle = C.marbleVein;
    ctx.lineWidth = 1;
    for (let i = 0; i < len * 2; i++) {
      const u = (i * 0.53) % len;
      const a = p(u, 20 + ((i * 37) % 140));
      const b = p(Math.min(len, u + 0.7), 30 + ((i * 53) % 150));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2, a.y - 10, b.x, b.y);
      ctx.stroke();
    }
    ctx.restore();
    // 金の帯（腰と天井）
    for (const [v0, v1] of [
      [30, 36],
      [WALL_H - 22, WALL_H - 16],
      [WALL_H - 6, WALL_H],
    ] as const) {
      quad(ctx, [p(0, v0), p(len, v0), p(len, v1), p(0, v1)], C.oldGold);
    }
    // 階段状の模様と時計の弧（2タイルごと）
    for (let u = 1; u < len; u += 2) {
      const doorHere = room.doors.some((d) => d.side === side && Math.abs((side === 'n' ? d.x + 0.5 : room.height - d.y - 0.5) - u) < 1.2);
      if (doorHere) continue;
      ctx.strokeStyle = 'rgba(215,171,82,0.55)';
      ctx.lineWidth = 1.5;
      // 階段状のアールデコ
      for (let k = 0; k < 4; k++) {
        const w = 0.5 - k * 0.1;
        const v = 60 + k * 14;
        const a = p(u - w, v);
        const b = p(u + w, v);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      // 時計の弧（放射状の線つき）
      const c = p(u, 140);
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, 26, 26, 0, Math.PI, 0);
      ctx.stroke();
      for (let i = 1; i < 6; i++) {
        const a = Math.PI + (i * Math.PI) / 6;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x + Math.cos(a) * 26, c.y + Math.sin(a) * 26);
        ctx.stroke();
      }
      // 壁の燭台の暖かい光
      if (u % 4 === 1) {
        const l = p(u, 110);
        const lg = ctx.createRadialGradient(l.x, l.y, 2, l.x, l.y, 70);
        lg.addColorStop(0, 'rgba(255,216,106,0.45)');
        lg.addColorStop(1, 'rgba(255,216,106,0)');
        ctx.fillStyle = lg;
        ctx.fillRect(l.x - 70, l.y - 70, 140, 140);
        ctx.fillStyle = C.gold;
        ctx.fillRect(l.x - 3, l.y - 6, 6, 12);
      }
    }
    // 壁の契約書（入口の奥右の壁）
    if (room.kind === 'entrance' && side === 'n') {
      const a = p(9.1, 120);
      const b = p(9.9, 120);
      const c2 = p(9.9, 66);
      const d = p(9.1, 66);
      quad(ctx, [a, b, c2, d], C.ivory);
      ctx.strokeStyle = C.red;
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const s = p(9.2, 110 - i * 8);
        const e = p(9.8, 110 - i * 8);
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(e.x, e.y);
        ctx.stroke();
      }
    }
  }
  // 扉（奥の壁は時計型のアーチ）
  for (const door of room.doors) drawDoorFrame(ctx, room, door, rooms);
}

function doorCenterU(room: Room, door: Door) {
  return door.side === 'n' ? door.x + 0.5 : room.height - door.y - 0.5;
}

function drawDoorFrame(ctx: Ctx, room: Room, door: Door, rooms: Record<string, Room>) {
  const label = TEXT.room[rooms[door.to]!.kind];
  if (door.side === 'n' || door.side === 'w') {
    const side = door.side;
    const u = doorCenterU(room, door);
    const p = (du: number, v: number) => wallPoint(side, room, u + du, v);
    // 開口（奥は暗い）
    const g = ctx.createLinearGradient(0, p(0, 130).y, 0, p(0, 0).y);
    g.addColorStop(0, '#05070C');
    g.addColorStop(1, '#141A2B');
    ctx.beginPath();
    const steps = 12;
    ctx.moveTo(p(-0.45, 0).x, p(-0.45, 0).y);
    ctx.lineTo(p(-0.45, 95).x, p(-0.45, 95).y);
    for (let i = 0; i <= steps; i++) {
      const a = Math.PI + (i * Math.PI) / steps;
      const q = p(Math.cos(a) * 0.45, 95 - Math.sin(a) * 40);
      ctx.lineTo(q.x, q.y);
    }
    ctx.lineTo(p(0.45, 0).x, p(0.45, 0).y);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = C.oldGold;
    ctx.lineWidth = 3;
    ctx.stroke();
    // 扉の上の時計
    const c = p(0, 160);
    ctx.fillStyle = C.ivory;
    ctx.beginPath();
    ctx.arc(c.x, c.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = C.brass;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = C.navy;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x, c.y - 9);
    ctx.moveTo(c.x, c.y);
    ctx.lineTo(c.x + 6, c.y + 2);
    ctx.stroke();
    label && drawLabel(ctx, p(0, 112).x, p(0, 112).y, label);
  } else {
    // 手前の扉: 床の敷居（金の線）と案内板
    const center = toScreen(door.x + 0.5, door.y + 0.5);
    const edge = door.side === 's' ? toScreen(door.x + 0.5, door.y + 1) : toScreen(door.x + 1, door.y + 0.5);
    ctx.fillStyle = 'rgba(215,171,82,0.25)';
    ctx.beginPath();
    ctx.ellipse(edge.x, edge.y, TILE_W * 0.45, TILE_H * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    drawLabel(ctx, center.x + (door.side === 's' ? -34 : 34), center.y + 34, `${label} ▸`);
  }
}

function drawLabel(ctx: Ctx, x: number, y: number, text: string) {
  ctx.save();
  ctx.font = `700 15px ${FONT_TITLE}`;
  const w = ctx.measureText(text).width + 16;
  ctx.fillStyle = 'rgba(11,15,26,0.85)';
  ctx.fillRect(x - w / 2, y - 12, w, 22);
  ctx.strokeStyle = C.oldGold;
  ctx.lineWidth = 1;
  ctx.strokeRect(x - w / 2, y - 12, w, 22);
  ctx.fillStyle = C.ivory;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawFloor(ctx: Ctx, room: Room) {
  const workshop = room.kind === 'workshop';
  for (let y = 0; y < room.height; y++) {
    for (let x = 0; x < room.width; x++) {
      const a = toScreen(x, y);
      const b = toScreen(x + 1, y);
      const c = toScreen(x + 1, y + 1);
      const d = toScreen(x, y + 1);
      const edge = x === 0 || y === 0 || x === room.width - 1 || y === room.height - 1;
      const base = workshop
        ? (x + y) % 2
          ? '#3A2C22'
          : '#34271E'
        : edge
          ? C.purpleDark
          : (x + y) % 2
            ? C.purple
            : '#3E3456';
      quad(ctx, [a, b, c, d], base);
      ctx.strokeStyle = edge ? 'rgba(215,171,82,0.35)' : 'rgba(215,171,82,0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.closePath();
      ctx.stroke();
      // 絨毯の幾何学模様（周縁だけ）
      if (edge && !workshop) {
        const m = toScreen(x + 0.5, y + 0.5);
        ctx.strokeStyle = 'rgba(215,171,82,0.4)';
        ctx.beginPath();
        ctx.moveTo(m.x, m.y - 9);
        ctx.lineTo(m.x + 18, m.y);
        ctx.lineTo(m.x, m.y + 9);
        ctx.lineTo(m.x - 18, m.y);
        ctx.closePath();
        ctx.stroke();
      }
    }
  }
  // 部屋の縁（金）
  ctx.strokeStyle = C.oldGold;
  ctx.lineWidth = 2;
  const corners = [toScreen(0, 0), toScreen(room.width, 0), toScreen(room.width, room.height), toScreen(0, room.height)];
  ctx.beginPath();
  corners.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  ctx.stroke();
  // 中央の時計の紋章（床に薄く）
  const center = toScreen(room.width / 2, room.height / 2);
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = C.oldGold;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(center.x, center.y, 150, 75, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    ctx.beginPath();
    ctx.moveTo(center.x + Math.cos(a) * 120, center.y + Math.sin(a) * 60);
    ctx.lineTo(center.x + Math.cos(a) * 150, center.y + Math.sin(a) * 75);
    ctx.stroke();
  }
  ctx.restore();
}

/** 扉の光（支配人が来る扉は赤く光る） */
export function drawDoorGlow(ctx: Ctx, room: Room, door: Door, color: string, strength: number) {
  const u = doorCenterU(room, door);
  const pos =
    door.side === 'n' || door.side === 'w'
      ? wallPoint(door.side, room, u, 60)
      : door.side === 's'
        ? toScreen(door.x + 0.5, door.y + 1)
        : toScreen(door.x + 1, door.y + 0.5);
  const g = ctx.createRadialGradient(pos.x, pos.y, 4, pos.x, pos.y, 110);
  g.addColorStop(0, color.replace('ALPHA', String(0.55 * strength)));
  g.addColorStop(1, color.replace('ALPHA', '0'));
  ctx.fillStyle = g;
  ctx.fillRect(pos.x - 110, pos.y - 110, 220, 220);
}
