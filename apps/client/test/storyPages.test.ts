import { describe, expect, it } from 'vitest';
import { CUTSCENE_CONFIG } from '../src/config/cutscene';
import ja from '../src/i18n/ja.json';
import en from '../src/i18n/en.json';
import { SCENE_IDS } from '../src/story/playback';
import { pageAt, pageSchedule, pageSeconds, STORY_PAGES } from '../src/story/pages';

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
});
