/**
 * スカウト回り（親方が新弟子を探しに出向く）。費用・人数・素質の上乗せは推定
 *
 * 時期は実際の大会に合わせる（docs/realism.md「スカウト回り」）:
 * - 中学・高校の全国大会は8月 → 秋場所の前
 * - 学生相撲の全国大会（全日本学生選手権）は11月 → 初場所の前
 * months は「これから取る場所」の番号（0 初場所 / 1 春 / 2 夏 / 3 名古屋 / 4 秋 / 5 九州）。null はいつでも
 */
import type { ScoutTripId } from '../model/types';

export interface ScoutTripDef {
  cost: number;
  months: readonly number[] | null;
  background: 'juniorHigh' | 'highSchool' | 'college' | 'otherSport';
  /** 出会える人数の範囲（スカウトの網のレベルごとに上限が1増える） */
  count: readonly [number, number];
  /** 素質の上乗せ */
  talentBonus: number;
  foreign?: boolean;
}

export const SCOUT_TRIPS: Record<ScoutTripId, ScoutTripDef> = {
  juniorHighMeet: {
    cost: 300_000,
    months: [4],
    background: 'juniorHigh',
    count: [1, 3],
    talentBonus: 6,
  },
  interHigh: {
    cost: 400_000,
    months: [4],
    background: 'highSchool',
    count: [1, 2],
    talentBonus: 8,
  },
  collegeMeet: {
    cost: 500_000,
    months: [0],
    background: 'college',
    count: [1, 2],
    talentBonus: 10,
  },
  countryside: {
    cost: 200_000,
    months: null,
    background: 'otherSport',
    count: [0, 2],
    talentBonus: 2,
  },
  overseas: {
    cost: 1_500_000,
    months: null,
    background: 'otherSport',
    count: [1, 1],
    talentBonus: 8,
    foreign: true,
  },
};

export const SCOUT_TRIP_IDS: readonly ScoutTripId[] = [
  'juniorHighMeet',
  'interHigh',
  'collegeMeet',
  'countryside',
  'overseas',
];
