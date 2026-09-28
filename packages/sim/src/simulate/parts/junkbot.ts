/**
 * ポンコツロボ: シード乱数で決まる方向（上下左右のいずれか）へ送る
 */
import { ALL_DIR4, dir4ToDir8 } from '../../core/direction';
import type { PartBehavior } from './types';

export const junkbotBehavior: PartBehavior = {
  react: ({ value, rng }) => {
    const dir = ALL_DIR4[rng.nextInt(ALL_DIR4.length)]!;
    return { emits: [{ dir: dir4ToDir8(dir), value }] };
  },
};
