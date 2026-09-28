/**
 * セーブデータ形式
 *
 * バージョン番号を必ず持たせ、形式を変えたときは SAVE_VERSION を上げて
 * migrateSave にマイグレーション処理を追加する。
 */
import type { RunState } from '@chain-factory/sim';

/** 現在のセーブデータのバージョン */
export const SAVE_VERSION = 1;

export interface SaveDataV1 {
  version: 1;
  /** 進行中のラン（なければ null） */
  run: RunState | null;
}

/** 最新バージョンのセーブデータ */
export type SaveData = SaveDataV1;

export function createSave(run: RunState | null): SaveData {
  return { version: SAVE_VERSION, run };
}

/**
 * 読み込んだデータを最新形式へ変換する。
 * 解釈できない場合は null（呼び出し側で新規扱いにする）。
 */
export function migrateSave(raw: unknown): SaveData | null {
  if (typeof raw !== 'object' || raw === null || !('version' in raw)) return null;
  const version = (raw as { version: unknown }).version;

  switch (version) {
    case 1:
      return raw as SaveDataV1;
    // 例: case 0: return migrateSave(convertV0toV1(raw));
    default:
      return null;
  }
}
