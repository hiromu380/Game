/**
 * 力士の個性（性格・体質）。効果の大きさはすべて推定の調整値
 *
 * 1人に0〜2個。ID・素質・身長から決まる（乱数は使わない。docs は CLAUDE.md「力士の個性」）
 */
export const TRAIT_IDS = [
  'diligent',
  'lazy',
  'bigStage',
  'practiceChamp',
  'tough',
  'fragileBody',
  'glutton',
  'popular',
  'sensitive',
  'studious',
  'calm',
] as const;

export type TraitId = (typeof TRAIT_IDS)[number];

/** 一緒には持たない組 */
export const TRAIT_EXCLUSIVE: readonly (readonly [TraitId, TraitId])[] = [
  ['diligent', 'lazy'],
  ['bigStage', 'practiceChamp'],
  ['tough', 'fragileBody'],
  ['sensitive', 'calm'],
];

export const TRAITS = {
  /** 持つ数の割合: 0個・1個（残りは2個） */
  none: 0.15,
  one: 0.6,
  /** 稽古熱心: よく伸びるが疲れる */
  diligent: { growth: 1.12, fatigue: 3 },
  /** 稽古嫌い: 伸びが鈍いが疲れにくい */
  lazy: { growth: 0.88, fatigue: -2 },
  /** 本場所に強い: 場所の調子が上がる */
  bigStage: { condition: 3 },
  /** 稽古場横綱: 稽古ではよく伸びるが、本場所では固くなる */
  practiceChamp: { growth: 1.08, condition: -3 },
  /** 頑丈 / けがしがち: けがのしやすさの倍率 */
  tough: { fragility: 0.75 },
  fragileBody: { fragility: 1.3 },
  /** 大食漢: 稽古のたびに体重が増えやすい */
  glutton: { gainKg: 0.8 },
  /** 人気者: 幕内の取組の懸賞が増える。自分の部屋の関取なら名声も少し */
  popular: { kensho: 1.5, prestigePerBasho: 0.3 },
  /** 繊細: 関取になる前は辞めたくなりやすい */
  sensitive: { retirePerYear: 0.15 },
  /** 研究熱心: 技の稽古がよく伸びる */
  studious: { waza: 1.25 },
  /** 冷静: 場所の調子の上下が小さい */
  calm: { conditionRange: 0.6 },
  /** 自分の弟子の個性が分かってくる場所数（番付に載ってから） */
  knownAfterBasho: 2,
  /** 得意技: この数以上勝ち、白星の2割以上を占める決まり手。選ばれやすくなる */
  tokuiMinWins: 5,
  tokuiShare: 0.2,
  tokuiWeight: 2.5,
} as const;
