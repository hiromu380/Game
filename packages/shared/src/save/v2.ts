/**
 * セーブデータ v2（フェーズ2）の形式
 * - ラン: RunConfig を含む RunState（9シフト・ボス・リロール・試運転回数）
 * - メタ進行: 解放済みパーツ・工場拡張・実績
 */
import type { MetaProgress, RunState } from '@chain-factory/sim';

export interface SaveDataV2 {
  version: 2;
  /** 進行中のラン（なければ null） */
  run: RunState | null;
  meta: MetaProgress;
}
