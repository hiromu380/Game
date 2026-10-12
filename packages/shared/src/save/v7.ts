/**
 * セーブデータ v7（レリック）の形式
 * - メタ進行に、これまでに手に入れたレリックの一覧（meta.relicsFound）が増えた。コレクションの「レリック」で見る
 * - v6 からの変換: 進行中のランで手に入れているレリックがあれば、それを図鑑に入れる
 */
import type { AchievementProgress, MetaProgress, RunState } from '@chain-factory/sim';
import type { StoryProgress } from './v6';

export interface SaveDataV7 {
  version: 7;
  /** 進行中のラン（なければ null） */
  run: RunState | null;
  meta: MetaProgress;
  achievements: AchievementProgress;
  story: StoryProgress;
}
