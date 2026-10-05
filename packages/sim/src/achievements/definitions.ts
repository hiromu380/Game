/**
 * 実績の定義（ID・隠し実績か・解除条件・Steam の進捗バーに使う統計）
 *
 * ID は Steamworks に登録する API 名と同じ。追加・変更したら Steamworks 用の一覧を書き出し直す
 * （pnpm --filter @chain-factory/sim achievements:export → docs/ops/steam-achievements.md の手順で登録）。
 * 名前・説明は i18n（apps/client/src/i18n の achievement.<ID>.name / .desc）に置く。
 *
 * デイリー系はサーバーで検証済みの結果（本番の確定・ランキング）を受け取ってから判定する。
 */
import type { BossModifierId } from '../balance';

/**
 * 解除条件
 * - shiftScore:      1シフトの出荷量が atLeast 以上
 * - shiftZero:       本番の出荷量が 0（隠し実績用）
 * - shiftCleared:    シフトをクリアした（boss を指定したらそのボスのシフト、'any' なら何かのボスのシフト）
 * - chain:           1回の稼働で連鎖数が atLeast 以上
 * - junkbotStreak:   1回の稼働でポンコツロボが count 回続けて最大倍率を出した
 * - overtimeCleared: 延長戦でクリアしたシフト数が atLeast 以上
 * - record:          メタ進行の記録（累計・回数）が atLeast 以上
 * - boardLevel:      工場拡張の段階が atLeast 以上（1: 8×8, 2: 9×9）
 * - allParts:        全パーツを解放した
 * - dailyDays:        週替わりチャレンジに参加した日数が atLeast 以上（1日1回の挑戦を日数で数える）
 * - weeklyCleared:    週替わりの挑戦で全シフトをクリアした
 * - weeklyTopPercent: 週替わりの確定した結果（結果発表）が上位 atMost % 以内
 */
export type AchievementCondition =
  | { kind: 'shiftScore'; atLeast: string }
  | { kind: 'shiftZero' }
  | { kind: 'shiftCleared'; boss?: BossModifierId | 'any' }
  | { kind: 'chain'; atLeast: number }
  | { kind: 'junkbotStreak'; count: number }
  | { kind: 'overtimeCleared'; atLeast: number }
  | { kind: 'record'; record: 'clears' | 'runsPlayed'; atLeast: number }
  | { kind: 'record'; record: 'totalShipped'; atLeast: string }
  | { kind: 'boardLevel'; atLeast: number }
  | { kind: 'allParts' }
  | { kind: 'dailyDays'; atLeast: number }
  | { kind: 'weeklyCleared' }
  | { kind: 'weeklyTopPercent'; atMost: number };

/** Steam 統計（回数系だけ。実績の進捗バーに使う） */
export type AchievementStatId = 'STAT_RUNS' | 'STAT_FULL_CLEARS' | 'STAT_DAILY_DAYS';

export interface AchievementDef {
  id: string;
  /** 隠し実績（解除するまで名前・説明を出さない） */
  hidden: boolean;
  condition: AchievementCondition;
  /** 進捗バーに使う統計（Steamworks の実績の設定で、この統計と上限を結びつける） */
  progressStat?: AchievementStatId;
}

const M = '1000000';
const B = '1000000000';
const T = '1000000000000';

export const ACHIEVEMENTS = [
  { id: 'ACH_FIRST_SHIP', hidden: false, condition: { kind: 'shiftScore', atLeast: '1' } },
  { id: 'ACH_FIRST_SHIFT', hidden: false, condition: { kind: 'shiftCleared' } },
  { id: 'ACH_FIRST_NIGHT', hidden: false, condition: { kind: 'shiftCleared', boss: 'any' } },
  {
    id: 'ACH_FULL_CLEAR',
    hidden: false,
    condition: { kind: 'record', record: 'clears', atLeast: 1 },
  },
  {
    id: 'ACH_FULL_CLEAR_10',
    hidden: false,
    condition: { kind: 'record', record: 'clears', atLeast: 10 },
    progressStat: 'STAT_FULL_CLEARS',
  },
  { id: 'ACH_BOSS_LOWOIL', hidden: false, condition: { kind: 'shiftCleared', boss: 'lowOil' } },
  {
    id: 'ACH_BOSS_REPAIR',
    hidden: false,
    condition: { kind: 'shiftCleared', boss: 'repairWork' },
  },
  {
    id: 'ACH_BOSS_INSPECTION',
    hidden: false,
    condition: { kind: 'shiftCleared', boss: 'strictInspection' },
  },
  {
    id: 'ACH_BOSS_SHORT',
    hidden: false,
    condition: { kind: 'shiftCleared', boss: 'shortShift' },
  },
  {
    id: 'ACH_BOSS_SHORTAGE',
    hidden: false,
    condition: { kind: 'shiftCleared', boss: 'partShortage' },
  },
  { id: 'ACH_CHAIN_25', hidden: false, condition: { kind: 'chain', atLeast: 25 } },
  { id: 'ACH_CHAIN_100', hidden: false, condition: { kind: 'chain', atLeast: 100 } },
  { id: 'ACH_CHAIN_300', hidden: false, condition: { kind: 'chain', atLeast: 300 } },
  { id: 'ACH_SHIFT_1M', hidden: false, condition: { kind: 'shiftScore', atLeast: M } },
  { id: 'ACH_SHIFT_1B', hidden: false, condition: { kind: 'shiftScore', atLeast: B } },
  { id: 'ACH_SHIFT_1T', hidden: false, condition: { kind: 'shiftScore', atLeast: T } },
  {
    id: 'ACH_TOTAL_1B',
    hidden: false,
    condition: { kind: 'record', record: 'totalShipped', atLeast: B },
  },
  {
    id: 'ACH_RUNS_10',
    hidden: false,
    condition: { kind: 'record', record: 'runsPlayed', atLeast: 10 },
    progressStat: 'STAT_RUNS',
  },
  {
    id: 'ACH_RUNS_50',
    hidden: false,
    condition: { kind: 'record', record: 'runsPlayed', atLeast: 50 },
    progressStat: 'STAT_RUNS',
  },
  { id: 'ACH_FACTORY_8', hidden: false, condition: { kind: 'boardLevel', atLeast: 1 } },
  { id: 'ACH_FACTORY_9', hidden: false, condition: { kind: 'boardLevel', atLeast: 2 } },
  { id: 'ACH_ALL_PARTS', hidden: false, condition: { kind: 'allParts' } },
  { id: 'ACH_OVERTIME_3', hidden: false, condition: { kind: 'overtimeCleared', atLeast: 3 } },
  { id: 'ACH_OVERTIME_9', hidden: false, condition: { kind: 'overtimeCleared', atLeast: 9 } },
  { id: 'ACH_DAILY_FIRST', hidden: false, condition: { kind: 'dailyDays', atLeast: 1 } },
  { id: 'ACH_DAILY_CLEAR', hidden: false, condition: { kind: 'weeklyCleared' } },
  { id: 'ACH_DAILY_TOP10', hidden: false, condition: { kind: 'weeklyTopPercent', atMost: 10 } },
  {
    id: 'ACH_DAILY_7',
    hidden: false,
    condition: { kind: 'dailyDays', atLeast: 7 },
    progressStat: 'STAT_DAILY_DAYS',
  },
  { id: 'ACH_JUNKBOT_JACKPOT', hidden: true, condition: { kind: 'junkbotStreak', count: 3 } },
  { id: 'ACH_ZERO', hidden: true, condition: { kind: 'shiftZero' } },
] as const satisfies readonly AchievementDef[];

export type AchievementId = (typeof ACHIEVEMENTS)[number]['id'];

export const ACHIEVEMENT_IDS: readonly AchievementId[] = ACHIEVEMENTS.map((a) => a.id);

export function isAchievementId(value: unknown): value is AchievementId {
  return typeof value === 'string' && (ACHIEVEMENT_IDS as readonly string[]).includes(value);
}
