/**
 * ランダムボット: 何も考えずに買って置く（下限の確認用）
 *
 * 「ゲームを理解していない人でも最初の数シフトは進めるか」「それ以降は脱落するか」を見る。
 */
import type { PartId } from '@chain-factory/sim';
import { applyMove, frontierCells, type Move } from '../moves';
import type { Bot } from './types';

export const randomBot: Bot = {
  name: 'random',
  playShift(initial, { rng }) {
    let state = initial;
    const moves: Move[] = [];
    const tryMove = (move: Move) => {
      const next = applyMove(state, move);
      if (next) {
        state = next;
        moves.push(move);
      }
    };

    tryMove({ kind: 'switch' });

    // 手持ちをすべて適当な場所に置き、買えるものを適当に買って置く
    for (let step = 0; step < 20; step++) {
      const cells = frontierCells(state);
      if (cells.length === 0) break;
      const [x, y] = cells[rng.nextInt(cells.length)]!;
      const dir = rng.nextInt(4) as 0 | 1 | 2 | 3;
      const inventory = Object.keys(state.inventory).filter((id) => id !== 'switch');

      if (inventory.length > 0) {
        const partId = inventory[rng.nextInt(inventory.length)] as PartId;
        tryMove({ kind: 'place', partId, placement: { type: 'cell', x, y, dir } });
        continue;
      }
      const affordable = state.shop
        .map((o, i) => ({ o, i }))
        .filter(({ o }) => !o.sold && o.price <= state.budget);
      if (affordable.length === 0 || rng.nextInt(4) === 0) break;
      const { o, i } = affordable[rng.nextInt(affordable.length)]!;
      tryMove({
        kind: 'buyPlace',
        offerIndex: i,
        partId: o.partId,
        placement: { type: 'cell', x, y, dir },
      });
    }
    return { state, moves };
  },
};
