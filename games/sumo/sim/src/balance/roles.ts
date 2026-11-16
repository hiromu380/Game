/**
 * 部屋の役目: 付け人とちゃんこ番（docs/rikishi-life.md「付け人」「相撲部屋の一日」）
 * 付け人の人数は 十両 2〜3・幕内 3〜4・横綱 8〜10 人（解説・報道）。ちゃんこ番は幕下以下の持ち回りで、
 * 幕下上位（15枚目あたりから）や有望な弟子は外す部屋が多い。伸びと疲れへの効き目は推定
 */
export const ROLES = {
  /** 関取ごとの付け人の人数（地位で決まる） */
  tsukebito: { juryo: 2, makuuchi: 3, O: 4, Y: 8 },
  /** ちゃんこ番を外れる幕下の枚目（これより上） */
  chankoExemptWithin: 15,
  /** 付け人: 関取の稽古相手になり伸びるが、世話で疲れる */
  tsukebitoGrowth: 1.05,
  tsukebitoFatigue: 3,
  /** ちゃんこ番: 1場所に要る人数（持ち回りの人数で割る） */
  chankoCooks: 2,
  /** ちゃんこ番を1人で受け持ったときの伸びの減りと疲れ（持ち回りの割合で薄まる） */
  chankoGrowthLoss: 0.1,
  chankoFatigue: 4,
  /** ちゃんこ番がひとりもいないとき: 部屋の全員の疲れの抜けが落ちる */
  noCookFatigue: 2,
  /** 相撲教習所: 入門から半年（前相撲の場所を入れて3場所）。四股などの基本を習い、伸びが少しよい（推定） */
  kyoshujoBasho: 3,
  kyoshujoGrowth: 1.05,
} as const;
