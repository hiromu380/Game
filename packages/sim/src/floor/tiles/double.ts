/** ×2床: 値を doubleMultiplier 倍（既定 ×2） */
import { scoreMul } from '../../core/score';
import type { FloorBehavior } from '../types';

export const doubleFloor: FloorBehavior = {
  apply: (value, params) => scoreMul(value, params.doubleMultiplier),
};
