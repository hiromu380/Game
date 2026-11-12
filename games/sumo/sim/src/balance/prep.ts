/**
 * 場所前の4週間（親方が毎週1つ行動を選ぶ）。効果の大きさはすべて推定の調整値（docs/balance-log.md）
 * 伸びの rate は「素質までの残りに掛ける割合」。ふだんの稽古は1場所で、方針の能力 0.07・ほか 0.015（balance/growth.ts）
 */
export const PREP = {
  /** 場所前の週の数 */
  weeks: 4,
  /** 個別指導: 弟子1人。稽古の方針の能力（体づくりなら体重と、3つを少しずつ） */
  coach: { rate: 0.02, fatigue: 6, bodyKg: 1, bodyRate: 0.006 },
  /** 申し合い: 弟子2人。相手の方が強ければ伸びが上がる。けがの確率（けがのしやすさ・設備が掛かる） */
  spar: { rate: 0.014, strongerBonus: 1.6, fatigue: 8, injury: 0.03 },
  /** 出稽古: けがのない全員の3つの能力。部屋の口座から */
  degeiko: { rate: 0.005, fatigue: 4, cost: 150_000 },
  /** 休ませる: 全員の疲れ */
  rest: { fatigue: -15 },
} as const;
