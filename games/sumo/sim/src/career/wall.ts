/**
 * 素質の壁: 壁に当たっているか・壁を破る（素質が上がる）。乱数を使わない
 */
import { WALL } from '../balance/wall';
import { round1 } from '../core/math';
import type { Rikishi, Style } from '../model/types';

/** 稽古の方針の能力（体づくりは一番高い能力。休養は null） */
export function focusOf(r: Pick<Rikishi, 'policy' | 'abilities'>): Style | null {
  if (r.policy === 'rest') return null;
  if (r.policy === 'body') {
    const a = r.abilities;
    return a.oshi >= a.yotsu && a.oshi >= a.waza ? 'oshi' : a.yotsu >= a.waza ? 'yotsu' : 'waza';
  }
  return r.policy;
}

/** 壁に当たっているか（方針の能力が素質の近く・ピークの年齢まで・けががない） */
export function atWall(r: Rikishi): boolean {
  const key = focusOf(r);
  return (
    key !== null &&
    r.injury === 0 &&
    r.age <= r.peakAge &&
    (r.breakthrough ?? 0) < WALL.maxBonus &&
    r.abilities[key] >= r.talent - WALL.margin
  );
}

/** 壁を破る: 素質を上げる（上がった量を返す。壁に当たっていなければ 0） */
export function breakWall(r: Rikishi, amount: number): number {
  if (!atWall(r)) return 0;
  const done = r.breakthrough ?? 0;
  const inc = round1(Math.min(WALL.maxBonus - done, amount * (1 - done / WALL.maxBonus)));
  if (inc <= 0) return 0;
  r.talent = round1(r.talent + inc);
  r.breakthrough = round1(done + inc);
  return inc;
}
