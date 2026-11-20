/**
 * 新十両の化粧まわしの手配（docs/rikishi-life.md「番付で変わること」）
 * 化粧まわしは後援会・郷土・タニマチから贈られることが多く、100万〜数百万円・納期は半年〜1年（報道）。
 * 間に合わなければ、師匠や部屋の関取のものを借りる。数値は推定
 */
export const KESHO = {
  /** 部屋で作るときの費用（円。推定: 報道の幅 100万〜400万円のなか） */
  cost: 3_000_000,
  /** タニマチに頼める関係の下限 */
  patronFavor: 40,
  /** 頼んだタニマチの関係の上がり（その弟子のひいきになる） */
  patronFavorGain: 5,
  /** 部屋で作ったときの名声と、後援会の会員の増え方（割合） */
  stablePrestige: 1,
  stableMembers: 0.05,
} as const;

export type KeshoFrom = 'patron' | 'stable' | 'borrowed';
export const KESHO_FROM: readonly KeshoFrom[] = ['patron', 'stable', 'borrowed'];
