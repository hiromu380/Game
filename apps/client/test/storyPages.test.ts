import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CUTSCENE_CONFIG } from '../src/config/cutscene';
import ja from '../src/i18n/ja.json';
import en from '../src/i18n/en.json';
import { SCENE_IDS } from '../src/story/playback';
import {
  isVoiced,
  pageAt,
  pageSchedule,
  pageSeconds,
  speakerBounce,
  STORY_PAGES,
  typedLength,
} from '../src/story/pages';

describe('紙芝居のページ', () => {
  it('全シーンにページがあり、文は ja・en の両方にある', () => {
    for (const id of SCENE_IDS) {
      expect(STORY_PAGES[id].length).toBeGreaterThan(0);
      for (const page of STORY_PAGES[id]) {
        expect(ja).toHaveProperty([page.text]);
        expect(en).toHaveProperty([page.text]);
      }
    }
  });

  it('表示秒数は文の長さで決まり、下限・上限に収まる', () => {
    const { min, max } = CUTSCENE_CONFIG.pages;
    expect(pageSeconds('', 'ja')).toBe(min);
    expect(pageSeconds('あ'.repeat(200), 'ja')).toBe(max);
    expect(pageSeconds('あ'.repeat(30), 'ja')).toBeGreaterThan(pageSeconds('あ'.repeat(10), 'ja'));
  });

  it('どのシーンも合計が上限時間に収まる（長すぎるときは縮める）', () => {
    for (const lang of ['ja', 'en'] as const) {
      const texts = Array.from({ length: 30 }, () => 'x'.repeat(300));
      expect(pageSchedule(texts, lang).at(-1)!.end).toBeCloseTo(CUTSCENE_CONFIG.maxDurationSec);
    }
  });

  it('経過時間からページと進み具合を求め、最後まで行ったら終わる', () => {
    const schedule = [
      { start: 0, end: 4 },
      { start: 4, end: 10 },
    ];
    expect(pageAt(schedule, 0)).toEqual({ index: 0, progress: 0, done: false });
    expect(pageAt(schedule, 2)).toEqual({ index: 0, progress: 0.5, done: false });
    expect(pageAt(schedule, 7)).toEqual({ index: 1, progress: 0.5, done: false });
    expect(pageAt(schedule, 10).done).toBe(true);
    expect(pageAt([], 0).done).toBe(true);
  });

  it('ページごとの表情は、そのキャラクターの表情の絵がある名前だけ', () => {
    for (const pages of Object.values(STORY_PAGES)) {
      for (const page of pages) {
        for (const [character, face] of Object.entries(page.faces ?? {})) {
          const file = new URL(
            `../src/assets/characters/${character}/expressions/${face}.svg`,
            import.meta.url,
          );
          expect(existsSync(file), `${character}/${face}`).toBe(true);
        }
      }
    }
  });

  it('ページの頭で話し手が跳ね、すぐ戻る。演出「中」は半分、「弱」では跳ねない', () => {
    const { height, seconds } = CUTSCENE_CONFIG.pages.bounce;
    expect(speakerBounce(0, 'full')).toBe(0);
    expect(speakerBounce(seconds / 2, 'full')).toBeCloseTo(height);
    expect(speakerBounce(seconds / 2, 'reduced')).toBeCloseTo(height / 2);
    expect(speakerBounce(seconds, 'full')).toBe(0);
    expect(speakerBounce(seconds / 2, 'minimal')).toBe(0);
  });

  it('セリフは時間とともに1文字ずつ出て、全文で止まる。演出「弱」では最初から全文', () => {
    const text = 'よーし、スイッチ入れまーす！';
    const cps = CUTSCENE_CONFIG.pages.typing.ja;
    expect(typedLength(text, 0, 'ja', 'full')).toBe(0);
    expect(typedLength(text, 3 / cps, 'ja', 'full')).toBe(3);
    expect(typedLength(text, 100, 'ja', 'full')).toBe([...text].length);
    expect(typedLength(text, 0, 'ja', 'minimal')).toBe([...text].length);
  });

  it('文字が出きる時間は、ページの表示時間より十分に短い（読む時間が残る）', () => {
    for (const pages of Object.values(STORY_PAGES)) {
      for (const page of pages) {
        for (const lang of ['ja', 'en'] as const) {
          const text = (lang === 'ja' ? ja : en)[page.text as keyof typeof ja];
          const typing = [...text].length / CUTSCENE_CONFIG.pages.typing[lang];
          expect(typing, page.text).toBeLessThan(pageSeconds(text, lang) * 0.6);
        }
      }
    }
  });

  it('声は文字・数字で鳴らし、空白・句読点では鳴らさない', () => {
    expect(isVoiced('あ')).toBe(true);
    expect(isVoiced('A')).toBe(true);
    expect(isVoiced('9')).toBe(true);
    expect(isVoiced('、')).toBe(false);
    expect(isVoiced(' ')).toBe(false);
    expect(isVoiced('！')).toBe(false);
  });
});
