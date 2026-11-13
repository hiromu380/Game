/**
 * 仕分け機（分岐系）: 発動するたびに、自身の向きから見て左 → 右 → 左 … と交互に同じ値で送る
 *
 * 分岐器は1本を左右2本に増やすが、仕分け機は本数を増やさず行き先を振り分ける。
 * コピー機の2連射や複数の経路から来た信号を、2つのラインへ1本ずつ配るのに使う。
 * 何回目かはシミュレーション中だけの状態で、盤面の向き自体は変わらない。
 */
import { dir4ToDir8 } from '../../core/direction';
import type { Dir4 } from '../../types';
import type { PartBehavior } from './types';

export const sorterBehavior: PartBehavior = {
  react: ({ part, value, state }) => {
    // 偶数回目は左（反時計回りに90度）、奇数回目は右（時計回りに90度）
    const dir = ((part.dir + (state % 2 === 0 ? 3 : 1)) % 4) as Dir4;
    return { emits: [{ dir: dir4ToDir8(dir), value }], nextState: state + 1 };
  },
};
