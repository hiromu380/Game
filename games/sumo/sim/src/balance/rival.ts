/**
 * ライバルの部屋（同期の親方の部屋）。数値はすべて推定の調整値
 */
export const RIVAL = {
  /** 関取どうしの直接対決で勝ったときの名声 */
  prestigePerWin: 0.4,
  /** 素質の見立てが高い入門希望者を、ライバルも狙っている確率 */
  contestChance: 0.45,
  /** 取り合いになる見立ての下限 */
  contestMinGrade: 4,
} as const;
