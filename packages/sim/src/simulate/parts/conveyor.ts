/**
 * ベルトコンベア: 受けた信号を、入ってきた向きに関係なく自身の向きへ送る
 */
import { dir4ToDir8 } from '../../core/direction';
import type { PartBehavior } from './types';

export const conveyorBehavior: PartBehavior = {
  react: ({ part, value }) => ({
    emits: [{ dir: dir4ToDir8(part.dir), value }],
  }),
};
