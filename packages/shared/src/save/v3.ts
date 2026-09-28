/**
 * セーブデータ v3（フェーズ4）の形式
 * - v2 に実績の状態（解除済み・デイリーの参加日数）を追加
 *   （Steam がオフラインでも解除を覚えておき、次に Steam が使えるときに送り直すため）
 */
import type { AchievementProgress, MetaProgress, RunState } from '@chain-factory/sim';

export interface SaveDataV3 {
  version: 3;
  /** 進行中のラン（なければ null） */
  run: RunState | null;
  meta: MetaProgress;
  achievements: AchievementProgress;
}
