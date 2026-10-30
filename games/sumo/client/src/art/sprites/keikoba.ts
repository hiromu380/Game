/**
 * 稽古場の絵の並べ方（純粋関数）。座標は絵の足元（下の中央）で、320×200 ドットの舞台の上
 */
import type { GameState } from '@ichimon/sim';

export const KEIKOBA_STAGE = { width: 320, height: 200 } as const;

export interface Placed {
  sprite: string;
  x: number;
  y: number;
}

/** 筋トレの器具が置かれる稽古場の改修の段 */
export const WEIGHTS_FROM_DOJO = 2;

export function keikobaLayout(game: Pick<GameState, 'player'>): Placed[] {
  const out: Placed[] = [
    { sprite: 'keikoba_back', x: 160, y: 190 },
    { sprite: 'zashiki', x: 100, y: 128 },
    { sprite: 'teppo', x: 250, y: 120 },
    { sprite: 'dohyo', x: 175, y: 170 },
  ];
  if (game.player.facilities.dojo >= WEIGHTS_FROM_DOJO)
    out.push({ sprite: 'weights', x: 232, y: 176 });
  return out;
}
