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

/**
 * キーの向き（WASD）→ 部屋の座標の向き。
 * W は画面の上（部屋の奥の角）、D は画面の右。斜め（W+D など）は部屋の壁に沿った向きになる
 * （W+D で奥右の壁沿い、W+A で奥左の壁沿いにまっすぐ進む）
 */
export function screenDirToRoom(dx: number, dy: number): Vec {
  const x = dx + dy;
  const y = dy - dx;
  const len = Math.hypot(x, y);
  return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
}

/** 部屋の座標の向き → 画面の向き（キャラの向きの描き分け） */
export function roomDirToScreen(v: Vec): Vec {
  return { x: v.x - v.y, y: (v.x + v.y) / 2 };
}

/** 描画の奥行き（大きいほど手前） */
export const depth = (x: number, y: number) => x + y;
