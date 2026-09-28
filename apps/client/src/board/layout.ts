/**
 * 盤面の描画レイアウト（マスの大きさ・座標変換）
 */
import { BALANCE } from '@chain-factory/sim';

/** 1マスの大きさ（px） */
export const CELL_SIZE = 72;
/** 盤面の外周の余白（px） */
export const BOARD_PADDING = 12;

export const BOARD_PIXEL_WIDTH = BALANCE.board.width * CELL_SIZE + BOARD_PADDING * 2;
export const BOARD_PIXEL_HEIGHT = BALANCE.board.height * CELL_SIZE + BOARD_PADDING * 2;

/** マス座標 → マス中心のピクセル座標 */
export function cellCenter(x: number, y: number): { px: number; py: number } {
  return {
    px: BOARD_PADDING + x * CELL_SIZE + CELL_SIZE / 2,
    py: BOARD_PADDING + y * CELL_SIZE + CELL_SIZE / 2,
  };
}

/** ピクセル座標 → マス座標（盤面外なら null） */
export function pixelToCell(
  px: number,
  py: number,
  width: number,
  height: number,
): { x: number; y: number } | null {
  const x = Math.floor((px - BOARD_PADDING) / CELL_SIZE);
  const y = Math.floor((py - BOARD_PADDING) / CELL_SIZE);
  if (x < 0 || y < 0 || x >= width || y >= height) return null;
  return { x, y };
}
