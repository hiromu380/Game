/**
 * 箱庭のマス目（アイソメトリック 2:1）。1マス = 32×16 ドット（docs/sprites/spec.md）
 * gx は右下へ、gy は左下へ進む。建物の正面は左下（+gy の向き）を向く
 */
export const TILE_W = 32;
export const TILE_H = 16;

export interface Point {
  x: number;
  y: number;
}

/** マス目の座標 → 画面のドット（マス (0,0) の上の角が原点） */
export function toScreen(gx: number, gy: number): Point {
  return { x: ((gx - gy) * TILE_W) / 2, y: ((gx + gy) * TILE_H) / 2 };
}

/** 押したときに開く所（部屋の画面のどこへ行くか） */
export type SceneAction = 'ledger' | 'staff' | 'stable' | 'scout' | 'banzuke' | 'policy';

/** マス目に置く物。gx・gy は奥の角、w は正面（左下の面）の幅、d は奥行き */
export interface Piece {
  sprite: string;
  gx: number;
  gy: number;
  w: number;
  d: number;
  action?: SceneAction;
  /** 絵に重ねて書く字（幟の四股名） */
  label?: string;
}

/** 物の足元のいちばん手前の角（絵の下の端をここに合わせる） */
export function frontCorner(p: Pick<Piece, 'gx' | 'gy' | 'w' | 'd'>): Point {
  return toScreen(p.gx + p.w, p.gy + p.d);
}

/** 奥から手前の順（手前の角が奥にある物から描く） */
export function depthOrder<T extends Pick<Piece, 'gx' | 'gy' | 'w' | 'd'>>(
  pieces: readonly T[],
): T[] {
  return [...pieces].sort(
    (a, b) => a.gx + a.w + a.gy + a.d - (b.gx + b.w + b.gy + b.d) || a.gx - b.gx,
  );
}

/** 2つの物の足元が重なるか */
export function overlaps(a: Piece, b: Piece): boolean {
  return a.gx < b.gx + b.w && b.gx < a.gx + a.w && a.gy < b.gy + b.d && b.gy < a.gy + a.d;
}
