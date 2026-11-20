/**
 * 週替わりチャレンジの暦（週の ID・日の ID と受付期間）
 *
 * - 日の ID: その地域の日付（'YYYY-MM-DD'）。区切りの時刻は「UTC からのずれ（分）」で決める（既定 540 = 日本時間0時）
 * - 週の ID: 週の始まりの日の ID（既定は月曜）。週の切り替えは、その曜日の日の区切りと同じ時刻
 * タイムゾーンのデータベースに頼らず、ずれだけで計算するので、どの実行環境でも同じ結果になる
 * （日本は夏時間がないため、固定のずれで十分）。
 */

const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

export interface CalendarConfig {
  /** UTC からのずれ（分） */
  offsetMinutes: number;
  /** 週の始まりの曜日（0 = 日曜 … 1 = 月曜） */
  weekStartDay: number;
}

const toId = (utcMidnightMs: number) => new Date(utcMidnightMs).toISOString().slice(0, 10);
const midnightOf = (id: string) => Date.parse(`${id}T00:00:00.000Z`);

/** now（UNIX ミリ秒）の時点の日の ID */
export function dayIdAt(nowMs: number, offsetMinutes: number): string {
  return new Date(nowMs + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** その日を含む週の ID */
export function weekIdOf(dayId: string, weekStartDay: number): string {
  const midnight = midnightOf(dayId);
  const weekday = new Date(midnight).getUTCDay();
  return toId(midnight - ((weekday - weekStartDay + 7) % 7) * DAY_MS);
}

/** now の時点の週の ID */
export function weekIdAt(nowMs: number, c: CalendarConfig): string {
  return weekIdOf(dayIdAt(nowMs, c.offsetMinutes), c.weekStartDay);
}

/** 日の受付期間（UNIX ミリ秒） */
export function dayWindow(dayId: string, offsetMinutes: number) {
  const opensAt = midnightOf(dayId) - offsetMinutes * 60_000;
  return { opensAt, closesAt: opensAt + DAY_MS };
}

/** 週の受付期間（UNIX ミリ秒） */
export function weekWindow(weekId: string, offsetMinutes: number) {
  const { opensAt } = dayWindow(weekId, offsetMinutes);
  return { opensAt, closesAt: opensAt + WEEK_MS };
}

/** n 週あと（負なら前）の週の ID */
export function addWeeks(weekId: string, n: number): string {
  return toId(midnightOf(weekId) + n * WEEK_MS);
}

/** 週の日の ID（7日分） */
export function daysOfWeek(weekId: string): string[] {
  return Array.from({ length: 7 }, (_, i) => toId(midnightOf(weekId) + i * DAY_MS));
}

/** 通し番号（epochWeekId の週を 1 として数える。シェア文の「#12」に使う） */
export function weekNumber(weekId: string, epochWeekId: string): number {
  return Math.round((midnightOf(weekId) - midnightOf(epochWeekId)) / WEEK_MS) + 1;
}

/** 'YYYY-MM-DD' 形式か */
export function isDateId(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** 週の ID として正しいか（日付の形で、週の始まりの曜日） */
export function isWeekId(value: string, weekStartDay: number): boolean {
  return isDateId(value) && weekIdOf(value, weekStartDay) === value;
}
