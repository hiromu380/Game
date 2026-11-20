/**
 * 場所前・場所の行事（docs/rikishi-life.md）
 * - 横綱審議委員会の稽古総見: 東京場所（初・夏・秋）の前。平幕中位以上の幕内は出るのが基本（報道）。効き目は推定
 */
export const SOKEN = {
  /** 東京場所（場所の番号 % 6） */
  months: [0, 2, 4],
  /** 出る前頭の枚目（これより上。三役以上はみな） */
  maegashiraWithin: 8,
  /** 総見の稽古: 方針の能力の伸びと疲れ */
  gain: 0.4,
  fatigue: 4,
} as const;
