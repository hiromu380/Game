/**
 * 取組の強さと勝つ確率
 */
import { BOUT } from '../balance/bout';
import { KIMARITE, KIMARITE_PICK } from '../balance/kimarite';
import type { Prng } from '../core/prng';
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

/**
 * 決まり手（見せるための情報。勝敗には影響しない）
 *
 * 勝った側の型・格下の逆転か・体重で重みを変え、乱数を1回だけ使って選ぶ
 */
export function kimariteFor(
  winner: Rikishi,
  loser: Rikishi,
  winnerProbability: number,
  rng: Prng,
): string {
  const style = styleOf(winner.abilities);
  const upset = winnerProbability < KIMARITE_PICK.upsetBelow;
  const weights = KIMARITE.map((k) => {
    let w = k.weight;
    if (k.style === style) w *= KIMARITE_PICK.styleMatch;
    else if (k.style === null) w *= KIMARITE_PICK.styleAny;
    if (k.reversal) w *= upset ? KIMARITE_PICK.reversalUpset : KIMARITE_PICK.reversalOther;
    if (k.motion === 'lift' && winner.weight < loser.weight) w *= KIMARITE_PICK.liftLighter;
    return w;
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = (rng.nextUint32() / 4294967296) * total;
  for (let i = 0; i < KIMARITE.length; i++) {
    roll -= weights[i]!;
    if (roll < 0) return KIMARITE[i]!.id;
  }
  return KIMARITE[KIMARITE.length - 1]!.id;
}
