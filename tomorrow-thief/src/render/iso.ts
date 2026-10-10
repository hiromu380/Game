/**
 * 等角投影（部屋の座標 ↔ 画面の座標）。基準画面 1920×1080
 */
import type { Vec } from '../core/types';

export const SCREEN_W = 1920;
export const SCREEN_H = 1080;
export const TILE_W = 112;
export const TILE_H = 56;
/** 壁の高さ（px） */
export const WALL_H = 190;

/** 部屋の原点（x=0, y=0 の角）の画面位置。部屋が画面の中央より少し下に来るように */
export const ORIGIN = { x: 876, y: 330 };

export function toScreen(x: number, y: number, z = 0): Vec {
  return {
    x: ORIGIN.x + ((x - y) * TILE_W) / 2,
    y: ORIGIN.y + ((x + y) * TILE_H) / 2 - z,
  };
}

/** 画面上の向き（WASD）→ 部屋の座標の向き */
export function screenDirToRoom(dx: number, dy: number): Vec {
  // 画面: sx = (x - y)·W/2, sy = (x + y)·H/2, H = W/2 → 向きだけなら x - y = dx, x + y = 2dy
  const x = (dx + 2 * dy) / 2;
  const y = (2 * dy - dx) / 2;
  const len = Math.hypot(x, y);
  return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
}

/** 部屋の座標の向き → 画面の向き（キャラの向きの描き分け） */
export function roomDirToScreen(v: Vec): Vec {
  return { x: v.x - v.y, y: (v.x + v.y) / 2 };
}

/** 描画の奥行き（大きいほど手前） */
export const depth = (x: number, y: number) => x + y;
