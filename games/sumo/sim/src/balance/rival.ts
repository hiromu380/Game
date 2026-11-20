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
  /**
   * 選び方: 師匠の年の差と、部屋の力（番付の点）の差の重み。
   * 年の差は ageScale 歳で 1、力の差は |a-b| / (大きい方 + strengthFloor)
   */
  choose: { age: 0.4, strength: 0.6, ageScale: 10, strengthFloor: 5 },
  /** 番付の点（地位ごと） */
  strengthPoints: {
    Y: 10,
    O: 7,
    sanyaku: 5,
    makuuchi: 3,
    juryo: 2,
    makushita: 0.5,
    sandanme: 0.2,
    lower: 0.1,
  },
  /** 年の終わりの見直し: ライバルになって何年たったら替わりうるか・どれだけ合う部屋なら替わるか */
  reviewAfterYears: 3,
  switchMargin: 0.25,
} as const;
