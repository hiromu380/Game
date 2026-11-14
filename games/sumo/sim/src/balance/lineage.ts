/**
 * 一門の系譜: 分家（独立）と分家の代替わり（すべて推定。docs/realism.md「独立（分家）」）
 */
export const LINEAGE = {
  /** 独立を申し出る部屋付きの親方の年齢の幅 */
  independenceAgeMin: 35,
  independenceAgeMax: 58,
  /** 部屋付きの親方になってからの場所数 */
  independenceAfterBasho: 24,
  /** 現役時代の最高位がこれ以上（幕内） */
  independenceMinDivision: 'makuuchi' as const,
  /** 1年あたりの申し出の確率 */
  independenceChancePerYear: 0.15,
  /** 連れて行ける内弟子の数 */
  maxTakeDisciples: 6,
  /** 分家の親方が定年のとき、跡継ぎがいる確率（いなければ部屋を閉じ、力士は本家へ移る） */
  branchSuccessionChance: 0.7,
  /** 分家の後継ぎの親方の年齢 */
  branchSuccessorAge: [36, 50] as const,
  /** 分家の成績が一門の名声になる割合 */
  branchPrestigeShare: 0.5,
};
