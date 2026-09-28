/**
 * ボルトのロケット（1ランの目的）の設定
 */
export const ROCKET_CONFIG = {
  /**
   * 延長戦の行き先（近い順）。延長戦を1日クリアするごとに1つ先へ届く。
   * 名前は i18n の `rocket.destination.<キー>`。最後まで届いたら、その先は「最後の行き先 +○日」と数える
   */
  destinations: [
    'moon',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'pluto',
    'galaxyEdge',
  ] as const,
} as const;

export type RocketDestination = (typeof ROCKET_CONFIG.destinations)[number];
