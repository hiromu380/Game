/** ×3床: 値を tripleMultiplier 倍（既定 ×3。3日目・延長戦のステージに出る） */
import { scoreMul } from '../../core/score';
import type { FloorBehavior } from '../types';

export const tripleFloor: FloorBehavior = {
  apply: (value, params) => scoreMul(value, params.tripleMultiplier),
};
