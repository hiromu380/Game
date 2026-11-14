/**
 * 一年の行事（docs/realism.md「一年の行事」）。巡業の効果の大きさは調整値
 */
/** 場所の後の巡業（何場所目の後か → 巡業の名前）。春場所の後に春巡業、名古屋の後に夏巡業、秋場所の後に秋巡業、九州の後に冬巡業 */
export const JUNGYO_AFTER: Record<number, 'spring' | 'summer' | 'autumn' | 'winter'> = {
  1: 'spring',
  3: 'summer',
  4: 'autumn',
  5: 'winter',
};

export const JUNGYO = {
  /** 巡業に出る関取の疲れ */
  fatigue: 8,
  /** 関取1人あたりの名声（地方での人気） */
  prestigePerSekitori: 0.3,
};
