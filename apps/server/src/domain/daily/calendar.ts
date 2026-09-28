/**
 * デイリーの日付（ID）と受付期間
 *
 * 切り替え時刻は設定値（タイムゾーンのずれ = 分）。初期値は日本時間0時（UTC+9 → 540分）。
 * タイムゾーンのデータベースに頼らず「UTC からのずれ」だけで計算するので、どの実行環境でも同じ結果になる
 * （日本は夏時間がないため、固定のずれで十分）。
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** now（UNIX ミリ秒）の時点で有効なデイリーの ID（'YYYY-MM-DD'） */
export function dailyIdAt(nowMs: number, offsetMinutes: number): string {
  return new Date(nowMs + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

/** そのデイリーの受付開始・締め切り（UNIX ミリ秒） */
export function dailyWindow(
  dailyId: string,
  offsetMinutes: number,
): { opensAt: number; closesAt: number } {
  const midnightUtc = Date.parse(`${dailyId}T00:00:00.000Z`);
  if (Number.isNaN(midnightUtc)) throw new Error(`invalid daily id: ${dailyId}`);
  const opensAt = midnightUtc - offsetMinutes * 60_000;
  return { opensAt, closesAt: opensAt + DAY_MS };
}

/** 翌日の ID */
export function nextDailyId(dailyId: string): string {
  return new Date(Date.parse(`${dailyId}T00:00:00.000Z`) + DAY_MS).toISOString().slice(0, 10);
}

/** 前日の ID */
export function previousDailyId(dailyId: string): string {
  return new Date(Date.parse(`${dailyId}T00:00:00.000Z`) - DAY_MS).toISOString().slice(0, 10);
}

/** 通し番号（epochDailyId を 1 として数える。シェア文の「#123」に使う） */
export function dailyNumber(dailyId: string, epochDailyId: string): number {
  const days =
    (Date.parse(`${dailyId}T00:00:00Z`) - Date.parse(`${epochDailyId}T00:00:00Z`)) / DAY_MS;
  return Math.round(days) + 1;
}

/** 'YYYY-MM-DD' 形式か */
export function isDailyId(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}
