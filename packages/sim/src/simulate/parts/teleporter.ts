/**
 * 転送装置（再発動系）: 受けた信号を、盤面上でいちばん近い別の転送装置へ瞬間移動させ、
 * そこから進んできた向きのまま送り出す（行き先の転送装置は発動しない）
 *
 * 距離はマス目の縦横の歩数。同じ距離なら上の行 → 左の列の順。ほかに転送装置がなければ、そのまま通り抜ける。
 */
import { getPart } from '../../core/board';
import type { Board } from '../../types';
import type { PartBehavior } from './types';

/** (x,y) の転送装置の行き先（なければ null） */
export function teleportTarget(board: Board, x: number, y: number): [number, number] | null {
  let best: [number, number] | null = null;
  let bestDist = Infinity;
  for (let ty = 0; ty < board.height; ty++) {
    for (let tx = 0; tx < board.width; tx++) {
      if ((tx === x && ty === y) || getPart(board, tx, ty)?.id !== 'teleporter') continue;
      const d = Math.abs(tx - x) + Math.abs(ty - y);
      if (d < bestDist) {
        best = [tx, ty];
        bestDist = d;
      }
    }
  }
  return best;
}

export const teleporterBehavior: PartBehavior = {
  react: ({ x, y, value, inDir, board }) => {
    const target = teleportTarget(board, x, y);
    return { emits: [{ dir: inDir, value, ...(target ? { from: target } : {}) }] };
  },
};
