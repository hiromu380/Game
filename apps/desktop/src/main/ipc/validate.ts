/**
 * IPC の引数の検証（メインプロセス側）
 *
 * レンダラーは信用しない（XSS などで乗っ取られた場合でも、メインプロセスでできることを最小限にするため）。
 * 型が違う・範囲外・許可されていない値は、すべて null（＝拒否）にする。
 */
import {
  isStorageKey,
  STAT_IDS,
  STORAGE_MAX_VALUE_LENGTH,
  type ScreenRect,
  type StatId,
  type StorageKey,
} from '@chain-factory/shared';
import { ACHIEVEMENT_ID_PATTERN } from '../steam/types';

export function validateStorageWrite(
  key: unknown,
  value: unknown,
): { key: StorageKey; value: string } | null {
  if (!isStorageKey(key) || typeof value !== 'string') return null;
  if (value.length > STORAGE_MAX_VALUE_LENGTH) return null;
  return { key, value };
}

/** 実績の ID（定義済みの一覧は4bで sim から渡す。ここでは形だけを確かめる） */
export function validateAchievementId(id: unknown, known?: ReadonlySet<string>): string | null {
  if (typeof id !== 'string' || !ACHIEVEMENT_ID_PATTERN.test(id)) return null;
  if (known && !known.has(id)) return null;
  return id;
}

const MAX_STAT_VALUE = 2 ** 31 - 1;

/** Steam 統計（回数系だけ。0 以上の整数） */
export function validateStats(stats: unknown): Partial<Record<StatId, number>> | null {
  if (typeof stats !== 'object' || stats === null || Array.isArray(stats)) return null;
  const result: Partial<Record<StatId, number>> = {};
  for (const [key, value] of Object.entries(stats)) {
    if (!(STAT_IDS as readonly string[]).includes(key)) return null;
    if (!Number.isInteger(value) || (value as number) < 0 || (value as number) > MAX_STAT_VALUE)
      return null;
    result[key as StatId] = value as number;
  }
  return result;
}

const MAX_SCREEN = 16384;

export function validateScreenRect(rect: unknown): ScreenRect | null {
  if (typeof rect !== 'object' || rect === null) return null;
  const r = rect as Record<string, unknown>;
  const fields = ['x', 'y', 'width', 'height'] as const;
  for (const f of fields) {
    const v = r[f];
    if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > MAX_SCREEN) return null;
  }
  return {
    x: r.x as number,
    y: r.y as number,
    width: r.width as number,
    height: r.height as number,
  };
}
