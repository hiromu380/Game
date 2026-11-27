/**
 * 経過時間の計測（ボットの思考時間の上限・レポートの所要時間だけに使う。結果の決定には使わない）
 *
 * Node・ブラウザ・Workers のどれでも動くよう、グローバルの performance があれば使う
 */
const perf = (globalThis as { performance?: { now(): number } }).performance;

export function nowMs(): number {
  return perf ? perf.now() : Date.now();
}
