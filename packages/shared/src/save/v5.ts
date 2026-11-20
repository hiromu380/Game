/**
 * セーブデータ v5（ランダム配置権）の形式
 * - ランに消耗品の項目が増えた: RunState.items（手持ちの消耗品）・RunState.itemFloors（配置権で湧いた床）・
 *   RunConfig.floorPermit（配置権の設定）。ショップの商品に消耗品（itemId つき）が並ぶようになった
 * - v4 のラン（配置権を導入する前に始めたラン）は、配置権の出ないランとしてそのまま続ける
 */
import type { AchievementProgress, MetaProgress, RunState } from '@chain-factory/sim';

export interface SaveDataV5 {
  version: 5;
  /** 進行中のラン（なければ null） */
  run: RunState | null;
  meta: MetaProgress;
  achievements: AchievementProgress;
}
