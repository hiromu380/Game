/**
 * 体験版 → 製品版のセーブの引き継ぎ（デスクトップ版）
 *
 * Steam の体験版は製品版と App ID もセーブのフォルダも別（Steam Cloud も共有されない）。
 * 製品版の初回起動時（まだ製品版のセーブがないとき）に、同じ PC に体験版のセーブがあれば引き継ぐかを1回だけ聞く。
 * - 引き継ぐもの: メタ進行（記録・解放）。体験版と製品版で同じ条件で数えているため、そのまま使える
 * - 引き継がないもの: 進行中のラン（体験版の設定: 初期パーツ・延長戦なし で作られているため）
 * どちらを選んでも製品版のセーブを作るので、2回目以降は聞かない。
 */
import { migrateSave } from '@chain-factory/shared';
import type { MetaProgress } from '@chain-factory/sim';
import { EDITION_CONFIG } from '../config/edition';
import { getPlatform } from '../platform';
import { loadSave, saveGame } from './saveStore';

/** 引き継げる体験版のメタ進行。聞く必要がなければ null */
export async function findDemoSaveToImport(): Promise<MetaProgress | null> {
  if (!EDITION_CONFIG.metaProgression || loadSave() !== null) return null;
  try {
    const raw = await getPlatform().readDemoSave();
    if (!raw) return null;
    const save = migrateSave(JSON.parse(raw));
    // 1回も遊んでいない体験版のセーブは、聞かずに無視する
    return save && save.meta.records.runsPlayed > 0 ? save.meta : null;
  } catch {
    return null;
  }
}

/** 答えを保存する（引き継ぐならそのメタ進行、引き継がないなら初期状態で、製品版のセーブを作る） */
export function answerDemoImport(meta: MetaProgress | null): void {
  saveGame({ run: null, ...(meta ? { meta } : {}) });
}
