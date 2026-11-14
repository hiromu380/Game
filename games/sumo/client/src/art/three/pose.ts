/**
 * 2D の取組台本を、土俵の3D座標に写す純粋関数。
 * 東（正の x）と西（負の x）は従来と同じ向き。
 */
import type { Pose } from '../../playback/boutScript';

export interface StagePose {
  x: number;
  depth: number;
  /** Z 軸回転。度で受け取りラジアンに直す */
  tilt: number;
}

/** 俵の中心までの3D距離。勝敗判定には使用しない */
export const TAWARA_RADIUS = 3.15;

export function toStagePose(p: Pose): StagePose {
  return {
    x: p.x * TAWARA_RADIUS,
    depth: Math.max(-0.6, Math.min(0.6, p.y * 1.25)),
    tilt: (-p.rot * Math.PI) / 180,
  };
}
