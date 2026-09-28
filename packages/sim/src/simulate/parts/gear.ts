/**
 * 増幅ギア: 値を gearMultiplier 倍（既定 ×2）して自身の向きへ送る
 */
import { dir4ToDir8 } from '../../core/direction';
import { scoreMul } from '../../core/score';
import type { PartBehavior } from './types';

export const gearBehavior: PartBehavior = {
  react: ({ part, value, rules }) => ({
    emits: [{ dir: dir4ToDir8(part.dir), value: scoreMul(value, rules.params.gearMultiplier) }],
  }),
};
