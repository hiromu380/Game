/**
 * セーブデータ v6（ストーリー演出）の形式
 * - 見たカットシーンの記録（story.seen）が増えた。初回だけ自動で再生し、タイトルの「思い出」から見直せる
 * - v5 までのプレイヤー（すでに遊んでいる人）は、オープニングを見た扱いにする（続きのランの途中に急に出さないため）
 */
import type { AchievementProgress, MetaProgress, RunState } from '@chain-factory/sim';

export interface StoryProgress {
  /** 見たカットシーンの ID（apps/client/src/story/scenes の id） */
  seen: string[];
}

export interface SaveDataV6 {
  version: 6;
  /** 進行中のラン（なければ null） */
  run: RunState | null;
  meta: MetaProgress;
  achievements: AchievementProgress;
  story: StoryProgress;
}
