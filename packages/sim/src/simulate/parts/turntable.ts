/**
 * 回転台（再発動系）: 自身の向きへ送り、発動するたびに時計回りに90度回る
 *
 * 置いたときの向き → 右回りに90度ずつ、と出力先が変わる。
 * 回った向きはシミュレーション中だけの状態で、盤面の向き自体は変わらない。
 */
import { dir4ToDir8 } from '../../core/direction';
import type { Dir4 } from '../../types';
import type { PartBehavior } from './types';

export const turntableBehavior: PartBehavior = {
  react: ({ part, value, state }) => {
    const dir = ((part.dir + state) % 4) as Dir4;
    return { emits: [{ dir: dir4ToDir8(dir), value }], nextState: state + 1 };
  },
};
