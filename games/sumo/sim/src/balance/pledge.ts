/**
 * 後援会との約束（すべて推定。docs/balance-log.md）
 * 年の初め（初場所の前）に、後援会にその年の約束をできる。約束すると先に支度金が部屋の口座に入り、
 * 九州場所の後に果たせたかを見る。果たせば名声が上がり、破れば支度金を返し、名声・会員・タニマチの関係が大きく下がる。
 * 大きな約束ほど支度金も罰も大きい（自分で背負う危険と見返り）
 */
export interface PledgeDef {
  /** 先にもらう支度金（円） */
  advance: number;
  /** 果たしたときの名声 */
  prestige: number;
  /** 破ったとき: 名声の減り・会員が離れる割合・タニマチの関係の減り */
  failPrestige: number;
  failMembers: number;
  failFavor: number;
  /** 破ったとき、支度金のうち返す割合 */
  failRepay: number;
}

export const PLEDGES = {
  /** この1年、弟子の場所ごとの勝ち越しを、全体の KACHIKOSHI_SHARE 以上にする */
  kachikoshi: {
    advance: 1_000_000,
    prestige: 1,
    failPrestige: 2,
    failMembers: 0.15,
    failFavor: 8,
    failRepay: 1,
  },
  /** 今年中に、部屋のいちばん上の弟子を上の段へ上げる（幕内なら三役へ） */
  division: {
    advance: 2_000_000,
    prestige: 2,
    failPrestige: 3,
    failMembers: 0.25,
    failFavor: 15,
    failRepay: 1,
  },
  /** 今年中に、新しい関取（新十両）を出す */
  sekitori: {
    advance: 5_000_000,
    prestige: 4,
    failPrestige: 5,
    failMembers: 0.4,
    failFavor: 25,
    failRepay: 1,
  },
} as const satisfies Record<string, PledgeDef>;

export type PledgeKind = keyof typeof PLEDGES;
export const PLEDGE_KINDS = Object.keys(PLEDGES) as PledgeKind[];

/** 「勝ち越しを重ねる」の約束で要る、勝ち越しの割合（推定） */
export const KACHIKOSHI_SHARE = 0.38;
