/**
 * 取組の強さと勝つ確率
 */
import { BOUT } from '../balance/bout';
import { clamp, winProbability } from '../core/math';
import type { Rikishi, Style } from '../model/types';
import { styleOf } from '../career/create';

/** 型の相性（三すくみ）: 押し > 技 > 四つ > 押し */
const BEATS: Record<Style, Style> = { oshi: 'waza', waza: 'yotsu', yotsu: 'oshi' };

/** 力士の強さ（調子 condition を足す） */
export function power(r: Rikishi, condition: number): number {
  const [a, b, c] = [r.abilities.oshi, r.abilities.yotsu, r.abilities.waza].sort(
    (x, y) => y - x,
  ) as [number, number, number];
  const [wa, wb, wc] = BOUT.abilityWeights;
  const weight = clamp(
    (r.weight - BOUT.weightBase) * BOUT.weightPerKg,
    BOUT.weightMin,
    BOUT.weightMax,
  );
  return a * wa + b * wb + c * wc + weight - r.fatigue * BOUT.fatiguePenalty + condition;
}

/** east が勝つ確率 */
export function eastWinProbability(
  east: Rikishi,
  west: Rikishi,
  condEast: number,
  condWest: number,
): number {
  let d = power(east, condEast) - power(west, condWest);
  const se = styleOf(east.abilities);
  const sw = styleOf(west.abilities);
  if (BEATS[se] === sw) d += BOUT.styleEdge;
  else if (BEATS[sw] === se) d -= BOUT.styleEdge;
  return winProbability(d, BOUT.k);
}

/** 決まり手（勝った側の型から選ぶ。見せるための情報） */
const KIMARITE: Record<Style, readonly string[]> = {
  oshi: ['oshidashi', 'tsukidashi', 'oshitaoshi', 'tsukiotoshi', 'hatakikomi'],
  yotsu: ['yorikiri', 'yorikiri', 'yoritaoshi', 'uwatenage', 'shitatenage', 'tsuridashi'],
  waza: [
    'tsukiotoshi',
    'hatakikomi',
    'hikiotoshi',
    'kotenage',
    'okuridashi',
    'katasukashi',
    'uwatedashinage',
  ],
};

export function kimariteFor(winner: Rikishi, pick: (items: readonly string[]) => string): string {
  return pick(KIMARITE[styleOf(winner.abilities)]);
}
