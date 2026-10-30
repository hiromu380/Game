/**
 * 部屋の絵（稽古場・外観）の並べ方（純粋関数）。座標は絵の足元（下の中央）で、舞台（stage）の上のドット
 */
import type { GameState } from '@ichimon/sim';

export interface Stage {
  width: number;
  height: number;
}

export const KEIKOBA_STAGE: Stage = { width: 320, height: 200 };
export const EXTERIOR_STAGE: Stage = { width: 440, height: 250 };

export interface Placed {
  sprite: string;
  x: number;
  y: number;
}

/** 筋トレの器具が置かれる稽古場の改修の段・今どきの稽古場に建て替わる段 */
export const WEIGHTS_FROM_DOJO = 2;
export const MODERN_FROM_DOJO = 3;

/** 稽古場（先頭が床と壁。ほかはその上に置く） */
export function keikobaLayout(game: Pick<GameState, 'player'>): Placed[] {
  const dojo = game.player.facilities.dojo;
  // 今どきの稽古場は、土俵と器具が描き込まれている
  if (dojo >= MODERN_FROM_DOJO) {
    return [
      { sprite: 'keikoba_modern', x: 160, y: 190 },
      { sprite: 'teppo', x: 70, y: 120 },
    ];
  }
  const out: Placed[] = [
    { sprite: 'keikoba_back', x: 160, y: 190 },
    { sprite: 'zashiki', x: 100, y: 128 },
    { sprite: 'teppo', x: 250, y: 120 },
    { sprite: 'dohyo', x: 175, y: 170 },
  ];
  if (dojo >= WEIGHTS_FROM_DOJO) out.push({ sprite: 'weights', x: 232, y: 176 });
  return out;
}

/** 外観: 母屋と、寮の増築の段に合わせた寮 */
export function exteriorLayout(game: Pick<GameState, 'player'>): Placed[] {
  const dorm = Math.min(2, game.player.facilities.dorm);
  return [
    { sprite: 'omoya', x: 130, y: 240 },
    { sprite: `dorm_${dorm}`, x: 315, y: 246 },
  ];
}
