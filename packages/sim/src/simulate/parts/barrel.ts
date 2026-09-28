/**
 * 爆発ドラム缶: 周囲8方向へ同じ値で同時に発射する（発動回数は balance/ で既定1回）
 */
import { ALL_DIR8 } from '../../core/direction';
import type { PartBehavior } from './types';

export const barrelBehavior: PartBehavior = {
  react: ({ value }) => ({
    emits: ALL_DIR8.map((dir) => ({ dir, value })),
  }),
};
