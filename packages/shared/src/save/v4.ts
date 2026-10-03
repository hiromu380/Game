/**
 * セーブデータ v4（床タイル）の形式
 * - ランに床の項目が増えた: RunConfig.stages（日ごとのステージ）・RunConfig.bonusFloors・RuleSet.floorParams・
 *   RunState.bonusFloor（シフト開始時のボーナス床）・今日の出来事の floorChanges
 * - v3 のラン（床を導入する前に始めたラン）は、床のないランとしてそのまま続ける
 */
import type { AchievementProgress, MetaProgress, RunState } from '@chain-factory/sim';

export interface SaveDataV4 {
  version: 4;
  /** 進行中のラン（なければ null） */
  run: RunState | null;
  meta: MetaProgress;
  achievements: AchievementProgress;
}
