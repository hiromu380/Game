/**
 * 能力の目盛り: 計算は 0〜100（小数1桁）のまま、画面では10倍の整数で見せる（押し 78.4 → 784、稽古の伸び 0.3 → +3）。
 * 昔のゲームの大きな数字で、1週の稽古の手応えが見えるようにする
 */
export const POINT_SCALE = 10;

/** 能力 → 画面の数 */
export function points(ability: number): number {
  return Math.round(ability * POINT_SCALE);
}

/** 能力の伸び → 符号つきの画面の数（動いていなければ ±0） */
export function signedPoints(delta: number): string {
  const v = Math.round(delta * POINT_SCALE);
  if (v === 0) return '±0';
  return (v > 0 ? '+' : '−') + Math.abs(v);
}
