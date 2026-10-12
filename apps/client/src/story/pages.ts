/**
 * 紙芝居のページ（純粋関数）
 *
 * 1ページ = シーンのある時刻の止め絵（at 秒）＋ 1〜2行の文（i18n のキー）。ページは自動でめくる。
 * 表示秒数は文の長さから決める（config/cutscene.ts の pages）。合計は上限時間（maxDurationSec）までに収める。
 * 絵はキーフレームの表（scenes/*.ts）をそのまま使い、その時刻の状態を描く
 */
import { CUTSCENE_CONFIG } from '../config/cutscene';
import type { SceneId } from './playback';

export interface StoryPage {
  /** 止め絵にするシーンの時刻（秒） */
  at: number;
  /** 文（i18n のキー） */
  text: string;
}

export const STORY_PAGES: Record<SceneId, StoryPage[]> = {
  opening: [
    { at: 2, text: 'story.page.opening.1' },
    { at: 21, text: 'story.page.opening.2' },
    { at: 31, text: 'story.page.opening.3' },
    { at: 39, text: 'story.page.opening.4' },
    { at: 45, text: 'story.page.opening.5' },
    { at: 51, text: 'story.page.opening.6' },
  ],
  interlude1: [
    { at: 1.5, text: 'story.page.interlude1.1' },
    { at: 6, text: 'story.page.interlude1.2' },
  ],
  interlude2: [
    { at: 3, text: 'story.page.interlude2.1' },
    { at: 7.5, text: 'story.page.interlude2.2' },
  ],
  gameOver: [
    { at: 1.5, text: 'story.page.gameOver.1' },
    { at: 3.5, text: 'story.page.gameOver.2' },
  ],
  ending: [
    { at: 4, text: 'story.page.ending.1' },
    { at: 12, text: 'story.page.ending.2' },
    { at: 21, text: 'story.page.ending.3' },
    { at: 27, text: 'story.page.ending.4' },
    { at: 37, text: 'story.page.ending.5' },
    { at: 47, text: 'story.page.ending.6' },
    { at: 56, text: 'story.page.ending.7' },
  ],
  demoTeaser: [{ at: 2, text: 'story.demoTeaser' }],
};

export type Lang = keyof typeof CUTSCENE_CONFIG.pages.perChar;

/** 文の長さから、ページを見せる秒数を決める */
export function pageSeconds(text: string, lang: Lang): number {
  const { base, perChar, min, max } = CUTSCENE_CONFIG.pages;
  const chars = [...text].length;
  return Math.min(max, Math.max(min, base + chars * perChar[lang]));
}

/** 各ページの開始・終了（秒）。合計が上限時間を超えるときは、全体を同じ割合で縮める */
export function pageSchedule(texts: string[], lang: Lang): { start: number; end: number }[] {
  const seconds = texts.map((text) => pageSeconds(text, lang));
  const total = seconds.reduce((a, b) => a + b, 0);
  const scale = Math.min(1, CUTSCENE_CONFIG.maxDurationSec / Math.max(total, 1e-9));
  let start = 0;
  return seconds.map((s) => {
    const page = { start, end: start + s * scale };
    start = page.end;
    return page;
  });
}

export interface PageState {
  index: number;
  /** ページの中の進み具合（0〜1） */
  progress: number;
  done: boolean;
}

/** 経過時間（秒）から、いまのページを求める */
export function pageAt(schedule: { start: number; end: number }[], elapsed: number): PageState {
  const last = schedule.at(-1);
  if (!last || elapsed >= last.end) {
    return { index: Math.max(0, schedule.length - 1), progress: 1, done: true };
  }
  const index = Math.max(
    0,
    schedule.findIndex((p) => elapsed < p.end),
  );
  const page = schedule[index]!;
  const progress = Math.min(1, Math.max(0, (elapsed - page.start) / (page.end - page.start)));
  return { index, progress, done: false };
}
