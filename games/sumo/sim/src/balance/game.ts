/**
 * ゲーム全体（調整値）
 */
export const GAME = {
  /** 架空の部屋の数（実際は 40 余り） */
  npcStables: 43,
  /** ゲーム開始時の自分の部屋の弟子（序ノ口〜三段目） */
  startDisciples: 4,
  /** 家訓の枠 */
  kakunSlots: 5,
  /** 名声: 関取 1人・三役・大関・横綱・幕内優勝ごとの加算（その場所に1度） */
  prestige: {
    sekitoriPerBasho: 0.5,
    newSekitori: 3,
    newSanyaku: 5,
    newOzeki: 10,
    newYokozuna: 20,
    makuuchiYusho: 8,
  },
  /** 名声は場所ごとに少しずつ薄れる（掛ける割合）。昔の栄光だけでは人は来ない */
  prestigeKeep: 0.97,
  /** 名声 → 入門希望者の増え方（名声いくつで1人増えるか・上限） */
  prestigePerCandidate: 30,
  maxExtraCandidates: 2,
  /** 部屋に住める力士の数の目安（推定。建物の大きさ。新弟子検査の制度ではない） */
  stableCapacity: 30,
};
