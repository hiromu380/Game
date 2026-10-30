/**
 * 稽古場・巡業の会場の絵の並べ方（純粋関数）。座標は絵の枠の下の中央で、舞台（stage）の上のドット。外観は art/hakoniwa/compound.ts
 */
import type { GameState } from '@ichimon/sim';
import type { Season } from '../hakoniwa/compound';
import type { SceneAction } from '../hakoniwa/grid';

export interface Stage {
  width: number;
  height: number;
}

export const KEIKOBA_STAGE: Stage = { width: 320, height: 200 };

export interface Placed {
  sprite: string;
  x: number;
  y: number;
  /** 絵に重ねて書く字（幟の四股名） */
  label?: string;
  action?: SceneAction;
}

/** 幟の布に名前の札を重ねる場所（幟の絵のドット。左上と幅・高さ） */
export const NOBORI_TAG = { x: 31, y: 54, width: 10, height: 38 } as const;

/** 筋トレの器具が置かれる稽古場の改修の段・今どきの稽古場に建て替わる段 */
export const WEIGHTS_FROM_DOJO = 2;
export const MODERN_FROM_DOJO = 3;

/** 稽古場（先頭が床と壁。ほかはその上に置く） */
export function keikobaLayout(game: Pick<GameState, 'player'>): Placed[] {
  const dojo = game.player.facilities.dojo;
  // 今どきの稽古場は、土俵と器具が描き込まれている
  if (dojo >= MODERN_FROM_DOJO) {
    return [
      { sprite: 'keikoba_modern', x: 160, y: 190, action: 'policy' },
      { sprite: 'teppo', x: 70, y: 120, action: 'policy' },
    ];
  }
  const out: Placed[] = [
    { sprite: 'keikoba_back', x: 160, y: 190 },
    { sprite: 'zashiki', x: 100, y: 128 },
    { sprite: 'teppo', x: 250, y: 120, action: 'policy' },
    { sprite: 'dohyo', x: 175, y: 170, action: 'policy' },
  ];
  if (dojo >= WEIGHTS_FROM_DOJO) out.push({ sprite: 'weights', x: 232, y: 176 });
  return out;
}

/** 巡業の舞台: 外に置いた土俵と吊り屋根・紅白幕・テント（春と秋は赤、夏と冬は藍白）・幟 */
export const JUNGYO_STAGE: Stage = { width: 440, height: 310 };
export const JUNGYO_BASE = 'dohyo_honbasho';

export function jungyoLayout(season: Season): Placed[] {
  const tent = season === 'summer' || season === 'winter' ? 'tent_ai' : 'tent';
  return [
    { sprite: 'kohaku_maku', x: 95, y: 230 },
    { sprite: tent, x: 360, y: 220 },
    { sprite: 'dohyo_honbasho', x: 220, y: 305 },
    { sprite: 'tsuriyane', x: 220, y: 150 },
    { sprite: 'nobori', x: 40, y: 290 },
    { sprite: 'nobori', x: 395, y: 302 },
  ];
}
