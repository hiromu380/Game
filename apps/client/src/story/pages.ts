/**
 * 紙芝居のページ（純粋関数）
 *
 * 1ページ = シーンのある時刻の止め絵（at 秒）＋ 話し手のセリフ（1〜2行。i18n のキー）。地の文（説明）は入れない。
 * ページは自動でめくる。
 * 表示秒数は文の長さから決める（config/cutscene.ts の pages）。合計は上限時間（maxDurationSec）までに収める。
 * 絵はキーフレームの表（scenes/*.ts）をそのまま使い、その時刻の状態を描く。
 * 表情だけはセリフに合わせてページごとに差し替えられる（faces。絵の動きの表は変えずに済むように）
 */
import { CUTSCENE_CONFIG } from '../config/cutscene';
import type { SceneId } from './playback';
import type { CharacterId, FrameState } from './timeline';

export interface StoryPage {
  /** 止め絵にするシーンの時刻（秒） */
  at: number;
  /** 話し手（名前を添える） */
  speaker: Speaker;
  /** セリフ（i18n のキー） */
  text: string;
  /** このページだけの表情（キャラクターごと。セリフの気持ちに合わせる。なければシーンの表のまま） */
  faces?: Partial<Record<CharacterId, string>>;
}

export type Speaker = 'bolt' | 'chief';

export const STORY_PAGES: Record<SceneId, StoryPage[]> = {
  opening: [
    {
      speaker: 'chief',
      at: 2,
      text: 'story.page.opening.1',
      faces: { chief: 'stern', bolt: 'tired' },
    },
    { speaker: 'bolt', at: 21, text: 'story.page.opening.2' },
    { speaker: 'bolt', at: 31, text: 'story.page.opening.3', faces: { bolt: 'sparkle' } },
    {
      speaker: 'chief',
      at: 39,
      text: 'story.page.opening.4',
      faces: { chief: 'soft', bolt: 'surprised' },
    },
    { speaker: 'bolt', at: 45, text: 'story.page.opening.5' },
    { speaker: 'bolt', at: 51, text: 'story.page.opening.6', faces: { bolt: 'happy' } },
  ],
  interlude1: [
    {
      speaker: 'chief',
      at: 1.5,
      text: 'story.page.interlude1.1',
      faces: { chief: 'stern', bolt: 'happy' },
    },
    { speaker: 'bolt', at: 6, text: 'story.page.interlude1.2', faces: { bolt: 'sparkle' } },
  ],
  interlude2: [
    // ネジがカラカラでも明るく流す（暗い事実を明るく言うのが笑いどころ）
    { speaker: 'bolt', at: 3, text: 'story.page.interlude2.1', faces: { bolt: 'happy' } },
    { speaker: 'bolt', at: 7.5, text: 'story.page.interlude2.2', faces: { bolt: 'happy' } },
  ],
  gameOver: [
    {
      speaker: 'chief',
      at: 1.5,
      text: 'story.page.gameOver.1',
      faces: { chief: 'stern', bolt: 'sad' },
    },
    {
      speaker: 'bolt',
      at: 3.5,
      text: 'story.page.gameOver.2',
      faces: { chief: 'soft', bolt: 'happy' },
    },
  ],
  ending: [
    { speaker: 'bolt', at: 4, text: 'story.page.ending.1' },
    {
      speaker: 'chief',
      at: 12,
      text: 'story.page.ending.2',
      faces: { chief: 'soft', bolt: 'happy' },
    },
    { speaker: 'bolt', at: 21, text: 'story.page.ending.3' },
    { speaker: 'bolt', at: 27, text: 'story.page.ending.4' },
    { speaker: 'bolt', at: 37, text: 'story.page.ending.5' },
    { speaker: 'bolt', at: 47, text: 'story.page.ending.6' },
    { speaker: 'chief', at: 56, text: 'story.page.ending.7', faces: { chief: 'soft' } },
  ],
  demoTeaser: [{ speaker: 'bolt', at: 2, text: 'story.page.demoTeaser.1' }],
};

/** ページの表情を、その時刻の絵（シーンの表から求めた状態）に重ねる */
export function applyPageFaces(frame: FrameState, page: StoryPage): FrameState {
  const faces = page.faces;
  if (!faces) return frame;
  return {
    ...frame,
    actors: frame.actors.map((a) => {
      const face = faces[a.character];
      return face ? { ...a, face } : a;
    }),
  };
}

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
