/**
 * 決定論的な計算の補助
 *
 * Math.exp などは環境で結果が1ビット違うことがあるので使わない。四則演算と比較だけで作る。
 */

/** 強さの差 d から勝つ確率（0〜1）。d = 0 で 0.5、k が大きいほどなだらか */
export function winProbability(d: number, k: number): number {
  return 0.5 + (0.5 * d) / (Math.abs(d) + k);
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** 小数第1位で丸める（表示や保存で値がぶれないように） */
export function round1(v: number): number {
  return Math.round(v * 10) / 10;
}
