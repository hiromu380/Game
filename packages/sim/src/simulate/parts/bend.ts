/**
 * 曲がりレール（再発動系）: 受けた信号を、進んできた向きから時計回りに90度曲げて送る
 *
 * 自身の向きは使わない（どの向きから入っても右へ曲がる）。4つ並べると信号が輪を描く。
 */
import type { Dir8 } from '../../types';
import type { PartBehavior } from './types';

export const bendBehavior: PartBehavior = {
  react: ({ value, inDir }) => ({ emits: [{ dir: ((inDir + 2) % 8) as Dir8, value }] }),
};
