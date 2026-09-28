/**
 * 盤面の操作ヘルパー（すべて純粋関数。元の盤面は変更せず新しい盤面を返す）
 */
import type { Board, Part } from '../types';
import { ALL_DIR4, dir4ToDir8, dir8Delta } from './direction';

export function createEmptyBoard(width: number, height: number): Board {
  return { width, height, cells: Array.from({ length: width * height }, () => null) };
}

export function isInside(board: Board, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < board.width && y < board.height;
}

export function cellIndex(board: Board, x: number, y: number): number {
  return y * board.width + x;
}

/** (x,y) のパーツ。盤面外や空マスなら null */
export function getPart(board: Board, x: number, y: number): Part | null {
  if (!isInside(board, x, y)) return null;
  return board.cells[cellIndex(board, x, y)] ?? null;
}

/** (x,y) にパーツを置いた（または null で空にした）新しい盤面を返す */
export function setPart(board: Board, x: number, y: number, part: Part | null): Board {
  if (!isInside(board, x, y)) throw new Error(`Out of board: (${x}, ${y})`);
  const cells = board.cells.slice();
  cells[cellIndex(board, x, y)] = part;
  return { ...board, cells };
}

/** 上下左右4マスの座標（盤面内のみ） */
export function neighbors4(board: Board, x: number, y: number): [number, number][] {
  const result: [number, number][] = [];
  for (const d of ALL_DIR4) {
    const [dx, dy] = dir8Delta(dir4ToDir8(d));
    if (isInside(board, x + dx, y + dy)) result.push([x + dx, y + dy]);
  }
  return result;
}
