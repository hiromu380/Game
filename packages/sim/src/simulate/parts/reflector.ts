/**
 * 反射板（再発動系）: 入ってきた方向へ信号を跳ね返す（値はそのまま。向きは関係ない）
 *
 * 往復させると、来た道のパーツをもう一度通る。相手側にも発動回数が残っている必要がある。
 */
import type { Dir8 } from '../../types';
import type { PartBehavior } from './types';

export const reflectorBehavior: PartBehavior = {
  react: ({ inDir, value }) => ({
    emits: [{ dir: ((inDir + 4) % 8) as Dir8, value }],
  }),
};
