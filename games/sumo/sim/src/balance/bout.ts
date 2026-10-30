/**
 * 取組の強さと勝つ確率
 */
export const BOUT = {
  /** 強さ = 型の能力 × 重み（一番高い・二番目・三番目） */
  abilityWeights: [0.6, 0.25, 0.15] as const,
  /** 体重の補正: (体重 − 基準) × 係数（上下限つき） */
  weightBase: 140,
  weightPerKg: 0.08,
  weightMin: -6,
  weightMax: 6,
  /** 型の相性で有利な側に足す */
  styleEdge: 3,
  /** 疲労 1 あたりの減点 */
  fatiguePenalty: 0.05,
  /** 勝つ確率のなだらかさ（core/math.ts の winProbability） */
  k: 7,
  /** 場所ごとの調子（気力）の幅 ± */
  conditionRange: 4,
};
