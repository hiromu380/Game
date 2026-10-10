/**
 * 週・日の ID（'YYYY-MM-DD'）の計算（画面表示用。週の区切りはサーバーが決めるので、ここでは日付の足し算だけ）
 */
const DAY_MS = 24 * 60 * 60 * 1000;

const toMs = (id: string) => Date.parse(`${id}T00:00:00Z`);
const toId = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** id から days 日後の ID */
export function addDays(id: string, days: number): string {
  return toId(toMs(id) + days * DAY_MS);
}

/** その週の7日（週の始まりの日から順に） */
export function daysOfWeek(weekId: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekId, i));
}

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** 曜日（0: 日曜 … 6: 土曜） */
export function weekdayOf(id: string): Weekday {
  return new Date(toMs(id)).getUTCDay() as Weekday;
}

/** 'YYYY-MM-DD' → { month, day }（表示用） */
export function monthDay(id: string): { month: number; day: number } {
  return { month: Number(id.slice(5, 7)), day: Number(id.slice(8, 10)) };
}
