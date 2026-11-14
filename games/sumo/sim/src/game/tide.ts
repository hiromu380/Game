/**
 * 今週の好機と逆風: 場所と週で決まる（乱数は用途別の流れ。状態を持たない純粋関数なので、セーブに持たない）
 */
import { PREP } from '../balance/prep';
import { TIDE_CHANCE, TIDE_IDS, TIDES, type TideDef, type TideId } from '../balance/tide';
import { createPrng, deriveSeed, SEED } from '../core/prng';
import type { GameState } from '../model/types';

/** その場所の week 週目（1 始まり）の好機・逆風。なければ null */
export function tideOf(state: Pick<GameState, 'seed' | 'bashoIndex'>, week: number): TideId | null {
  if (week < 1 || week > PREP.weeks) return null;
  const rng = createPrng(deriveSeed(state.seed, SEED.tide, state.bashoIndex, week));
  if (!rng.chance(TIDE_CHANCE)) return null;
  const total = TIDE_IDS.reduce((n, id) => n + TIDES[id].weight, 0);
  let roll = (rng.nextUint32() / 4294967296) * total;
  for (const id of TIDE_IDS) {
    roll -= TIDES[id].weight;
    if (roll < 0) return id;
  }
  return TIDE_IDS[TIDE_IDS.length - 1]!;
}

/** 効き目（なければ何も掛からない） */
export function tideDef(id: TideId | null): TideDef | null {
  return id ? TIDES[id] : null;
}
