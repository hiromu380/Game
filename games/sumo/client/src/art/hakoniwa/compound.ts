/**
 * 部屋の敷地（外観）の並べ方: 塀で囲んだ敷地に、母屋・寮・ちゃんこ場・治療院・門と庭の物を置く（純粋関数）
 * 門は手前左の塀（gy = PLOT.d）にあり、外は道。関取の幟は門の右の前庭に立てる
 */
import { isSekitori, ranksOf, type GameState } from '@ichimon/sim';
import type { Piece } from './grid';

/** 敷地の広さ（マス） */
export const PLOT = { w: 24, d: 18 } as const;
/** 門の位置（手前左の塀の上。gx の範囲）。母屋の玄関の正面 */
export const GATE = { gx: 8, w: 5 } as const;
/** 門から母屋の玄関までの敷石（マス） */
export const PATH: readonly [number, number][] = [12, 13, 14, 15, 16, 17].flatMap((gy) => [
  [9, gy] as [number, number],
  [10, gy] as [number, number],
]);
/** 道の幅（敷地の外、手前左） */
export const STREET = 3;

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

/** 幟を立てる関取の数（番付の上から） */
export const NOBORI_MAX = 3;

export function compoundPieces(
  game: Pick<GameState, 'player' | 'bashoIndex' | 'rikishi' | 'banzuke' | 'titles'>,
): Piece[] {
  const f = game.player.facilities;
  const dorm = Math.min(2, f.dorm);
  // 奥に建物、手前の庭に小物（手前の物は建物に隠れない）
  const out: Piece[] = [
    { sprite: 'omoya', gx: 4, gy: 8, w: 7, d: 4, action: 'ledger' },
    dorm === 2
      ? { sprite: 'dorm_2', gx: 16, gy: 2, w: 6, d: 6, action: 'stable' }
      : { sprite: `dorm_${dorm}`, gx: 15, gy: 3, w: 7, d: 4, action: 'stable' },
    { sprite: 'chanko', gx: 18, gy: 11, w: 4, d: 4, action: 'staff' },
    { sprite: 'gate', gx: GATE.gx, gy: PLOT.d - 0.3, w: GATE.w, d: 0.3, action: 'scout' },
    { sprite: 'well', gx: 15, gy: 12, w: 2, d: 2 },
    { sprite: 'pine', gx: 22.5, gy: 9, w: 1, d: 1 },
    { sprite: `tree_season__${seasonOf(game.bashoIndex)}`, gx: 2, gy: 13, w: 1, d: 1 },
    { sprite: 'tsukubai', gx: 3.5, gy: 14.5, w: 1, d: 1 },
    { sprite: 'lantern', gx: 5, gy: 15.5, w: 1, d: 1 },
    { sprite: 'rock', gx: 1.5, gy: 15.5, w: 1, d: 1 },
    { sprite: 'nafuda', gx: 12.5, gy: 13, w: 1, d: 1, action: 'banzuke' },
    { sprite: 'chochin', gx: 13.5, gy: 16.5, w: 1, d: 1 },
  ];
  if (f.trainer >= 1) out.push({ sprite: 'clinic', gx: 12, gy: 8, w: 3, d: 3, action: 'staff' });
  // 関取の幟（番付の上から）を、門の右の前庭に
  const ranks = ranksOf(game.banzuke, game.titles);
  const mine = new Set(
    game.rikishi.filter((r) => r.stableId === game.player.stableId).map((r) => r.id),
  );
  const names = new Map(game.rikishi.map((r) => [r.id, r.name]));
  game.banzuke
    .filter((id) => mine.has(id) && isSekitori(ranks.get(id)!))
    .slice(0, NOBORI_MAX)
    .forEach((id, i) => {
      out.push({
        sprite: 'nobori',
        gx: 15.5 + i * 1.5,
        gy: 16.5,
        w: 1,
        d: 1,
        action: 'banzuke',
        label: names.get(id)!,
      });
    });
  return out;
}
