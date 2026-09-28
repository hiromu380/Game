/**
 * スイッチ: シミュレーション開始時に、向いている方向へ信号を発射する。
 * 発射処理は simulate.ts の初期化で行う。信号を受けても反応しない。
 */
import type { PartBehavior } from './types';

export const switchBehavior: PartBehavior = {
  react: null,
};
