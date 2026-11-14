/**
 * 引退相撲・断髪式（docs/realism.md「引退相撲・断髪式」）
 */

/** 最高位の区分（断髪式の規模を決める） */
export type DanpatsuTier = 'Y' | 'O' | 'sanyaku' | 'makuuchi' | 'juryo';
export const DANPATSU_TIERS: readonly DanpatsuTier[] = ['Y', 'O', 'sanyaku', 'makuuchi', 'juryo'];

/** 国技館の引退相撲か、ホテルなどでの断髪式だけか */
export type DanpatsuVenue = 'kokugikan' | 'hotel';

export const DANPATSU = {
  /** 国技館で引退相撲を行える関取の在位場所数（慣行。出典: 引退相撲の解説） */
  kokugikanSekitoriBasho: 30,
  /** 国技館の引退相撲は、引退からおよそ半年後の東京場所（初・夏・秋）の後 */
  kokugikanDelay: 3,
  /** 東京場所（1年の何番目の場所か。0 = 初場所） */
  tokyoBasho: [0, 2, 4] as readonly number[],
  /** ホテル・部屋での断髪式は、次の場所の後（推定） */
  hotelDelay: 1,
  /**
   * はさみを入れる人数の目安（国技館）。横綱は 2026年1月の例で約330人、ほかは推定。
   * ホテルは掛ける割合。人ごとに ±15% ばらつく
   */
  hasami: { Y: 330, O: 270, sanyaku: 220, makuuchi: 170, juryo: 110 } as Record<
    DanpatsuTier,
    number
  >,
  hotelShare: 0.5,
  spread: 0.15,
  /** 部屋の名声（推定）。ホテルは hotelShare を掛ける */
  prestige: { Y: 6, O: 4, sanyaku: 3, makuuchi: 2, juryo: 1 } as Record<DanpatsuTier, number>,
  /** 後援会の会員が増える（来た人が会員になる。推定）。ホテルは hotelShare を掛ける */
  members: { Y: 200, O: 120, sanyaku: 80, makuuchi: 50, juryo: 30 } as Record<DanpatsuTier, number>,
  /** タニマチの関係（はさみを入れてもらう。推定） */
  patronFavor: { kokugikan: 4, hotel: 2 } as Record<DanpatsuVenue, number>,
  /** 演出で名前を出すタニマチの数 */
  patronsShown: 2,
} as const;
