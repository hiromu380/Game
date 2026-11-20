/**
 * 土俵の勝負俵の配置。描画用の純粋関数で、ゲームの勝敗には関与しない。
 * 3Dエンジン非依存なので数・間隔・回転の整合をテストできる。
 */
import { TAWARA_RADIUS } from './pose';

export interface BalePosition {
  x: number;
  z: number;
  /** 俵の長軸が向く単位ベクトル（円周の接線方向） */
  dx: number;
  dz: number;
}

/** 形の角が規則的すぎないよう、低ポリゴンの俵を等間隔に配置する。 */
export function dohyoBales(count = 28): BalePosition[] {
  if (!Number.isInteger(count) || count < 4 || count > 120) {
    throw new RangeError('俵の数は4から120までの整数');
  }
  return Array.from({ length: count }, (_, i) => {
    const theta = (2 * Math.PI * i) / count;
    return {
      x: TAWARA_RADIUS * Math.cos(theta),
      z: TAWARA_RADIUS * Math.sin(theta),
      dx: -Math.sin(theta),
      dz: Math.cos(theta),
    };
  });
}
