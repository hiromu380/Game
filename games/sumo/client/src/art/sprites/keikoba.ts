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
/** 1枚絵の稽古場・部屋の中の舞台（絵は 384×216） */
export const ROOM_STAGE: Stage = { width: 400, height: 228 };

/** その並べ方の舞台（1枚絵の稽古場なら広い舞台） */
export function keikobaStage(items: readonly Placed[]): Stage {
  return items[0]?.sprite.startsWith('keikoba_classic') ? ROOM_STAGE : KEIKOBA_STAGE;
}

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

/** 土俵・上がり座敷・鉄砲柱を描き込んだ1枚絵（器具なし・器具つき） */
export const CLASSIC = { plain: 'keikoba_classic__plain', gym: 'keikoba_classic__gym' } as const;

/** 1枚絵の稽古場に置く器具（土俵の右手前の床。舞台 400×228） */
const GYM_PROPS: Placed[] = [
  { sprite: 'gym_stone', x: 352, y: 150 },
  { sprite: 'gym_tire', x: 330, y: 163 },
  { sprite: 'gym_barbell', x: 296, y: 180 },
];

/** 稽古場（先頭が床と壁。ほかはその上に置く） */
/**
 * has: その絵を取り込んであるか。土俵・座敷を描き込んだ1枚絵（keikoba_classic）があれば、部品を重ねる代わりにそれを使う
 */
export function keikobaLayout(
  game: Pick<GameState, 'player'>,
  has: (sprite: string) => boolean = () => false,
): Placed[] {
  const dojo = game.player.facilities.dojo;
  // 今どきの稽古場は、土俵と器具が描き込まれている
  if (dojo >= MODERN_FROM_DOJO) {
    return [
      { sprite: 'keikoba_modern', x: 160, y: 190, action: 'policy' },
      { sprite: 'teppo', x: 70, y: 120, action: 'policy' },
    ];
  }
  if (dojo < MODERN_FROM_DOJO && has(CLASSIC.plain)) {
    const gym = dojo >= WEIGHTS_FROM_DOJO && has(CLASSIC.gym);
    const out: Placed[] = [
      { sprite: gym ? CLASSIC.gym : CLASSIC.plain, x: 200, y: 224, action: 'policy' },
    ];
    // 器具つきの1枚絵がなければ、改修2段目から土俵の手前の床に器具を置く
    if (dojo >= WEIGHTS_FROM_DOJO && !gym)
      for (const p of GYM_PROPS) if (has(p.sprite)) out.push(p);
    return out;
  }
  const out: Placed[] = [
    { sprite: 'keikoba_back', x: 160, y: 190 },
    { sprite: 'zashiki', x: 98, y: 126 },
    { sprite: 'teppo', x: 250, y: 120, action: 'policy' },
    { sprite: 'dohyo', x: 190, y: 162, action: 'policy' },
  ];
  if (dojo >= WEIGHTS_FROM_DOJO) out.push({ sprite: 'weights', x: 136, y: 170 });
  return out;
}

/** 巡業の舞台: 外に置いた土俵と吊り屋根・紅白幕・テント（春と秋は赤、夏と冬は藍白）・幟 */
export const JUNGYO_STAGE: Stage = { width: 440, height: 310 };
export const JUNGYO_BASE = 'dohyo_honbasho';

export function jungyoLayout(
  season: Season,
  has: (sprite: string) => boolean = () => true,
): Placed[] {
  const tent = season === 'summer' || season === 'winter' ? 'tent_ai' : 'tent';
  return [
    // 櫓太鼓と屋台（取り込んだ絵があれば）
    { sprite: 'yagura', x: 400, y: 170 },
    { sprite: 'kohaku_maku', x: 95, y: 230 },
    { sprite: tent, x: 360, y: 220 },
    { sprite: 'dohyo_honbasho', x: 220, y: 305 },
    { sprite: 'tsuriyane', x: 220, y: 150 },
    { sprite: 'nobori', x: 40, y: 290 },
    { sprite: 'nobori', x: 395, y: 302 },
    { sprite: 'yatai_red', x: 96, y: 308 },
    { sprite: 'yatai_green', x: 344, y: 308 },
  ].filter((p) => has(p.sprite));
}
