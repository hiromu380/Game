/**
 * 部屋の絵（稽古場・外観）の並べ方（純粋関数）。座標は絵の足元（下の中央）で、舞台（stage）の上のドット
 */
import type { GameState } from '@ichimon/sim';

export interface Stage {
  width: number;
  height: number;
}

export const KEIKOBA_STAGE: Stage = { width: 320, height: 200 };
export const EXTERIOR_STAGE: Stage = { width: 520, height: 320 };

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

/** 場所の季節（初場所は冬・春場所は春・夏場所と名古屋場所は夏・秋場所と九州場所は秋） */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
const SEASON_OF_BASHO: readonly Season[] = [
  'winter',
  'spring',
  'summer',
  'summer',
  'autumn',
  'autumn',
];

export function seasonOf(bashoIndex: number): Season {
  return SEASON_OF_BASHO[bashoIndex % 6]!;
}

/**
 * 外観: 寮（増築の段に合わせる）・母屋・治療院（トレーナー契約のとき）・ちゃんこ場・門と、塀・木・灯籠・庭石。
 * 奥から順（足元の y が小さい順）に並べる
 */
export function exteriorLayout(game: Pick<GameState, 'player' | 'bashoIndex'>): Placed[] {
  const f = game.player.facilities;
  const out: Placed[] = [
    { sprite: `dorm_${Math.min(2, f.dorm)}`, x: 385, y: 220 },
    { sprite: 'omoya', x: 200, y: 240 },
    { sprite: 'chanko', x: 420, y: 310 },
    { sprite: 'gate', x: 230, y: 318 },
    { sprite: 'fence_corner', x: 60, y: 185 },
    { sprite: 'pine', x: 490, y: 200 },
    { sprite: `tree_season__${seasonOf(game.bashoIndex)}`, x: 300, y: 170 },
    { sprite: 'lantern', x: 300, y: 316 },
    { sprite: 'rock', x: 30, y: 312 },
  ];
  if (f.trainer >= 1) out.push({ sprite: 'clinic', x: 90, y: 275 });
  return out.sort((a, b) => a.y - b.y);
}

/** 外観の土台（これがなければ外観を出さない） */
export const EXTERIOR_BASE = 'omoya';
