/**
 * セーブ（localStorage）。古い版は sim の migrateSave で今の版に変換する。読めないセーブは捨てる
 */
import { migrateSave, type GameState } from '@ichimon/sim';
import type { GuideProgress } from './guide';

const KEY = 'ichimon.save';
const SETTINGS_KEY = 'ichimon.settings';

export function loadGame(): GameState | null {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return null;
    return migrateSave(JSON.parse(text));
  } catch {
    return null;
  }
}

export function saveGame(state: GameState | null): void {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    // 保存できなくても遊べる
  }
}

/** ファイルに書き出すセーブ（localStorage と同じ形） */
export function saveFileText(state: GameState): string {
  return JSON.stringify(state);
}

/** ファイルから読んだセーブ。古い版は変換し、一門のセーブでなければ null */
export function parseSaveFile(text: string): GameState | null {
  try {
    const g = migrateSave(JSON.parse(text));
    if (
      !g ||
      !Array.isArray(g.rikishi) ||
      !Array.isArray(g.stables) ||
      typeof g.player !== 'object'
    )
      return null;
    return g.stables.some((s) => s.id === g.player.stableId) ? g : null;
  } catch {
    return null;
  }
}

/** 1: 言語 / 2: 効果音の入り切り / 3: はじめての人向けの案内の進み具合 */
export interface Settings {
  version: 3;
  lang: 'ja' | 'en';
  sound: boolean;
  guide: GuideProgress;
}

export const DEFAULT_GUIDE: GuideProgress = { dismissed: false, done: [], tips: [] };

export const DEFAULT_SETTINGS: Settings = {
  version: 3,
  lang: 'ja',
  sound: true,
  guide: DEFAULT_GUIDE,
};

const strings = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [];

/** 保存した設定を読む（版1は効果音を入れ、版1・2は案内をはじめから。壊れていれば既定） */
export function parseSettings(text: string | null): Settings {
  try {
    const s = JSON.parse(text ?? 'null') as {
      version?: number;
      lang?: 'ja' | 'en';
      sound?: boolean;
      guide?: { dismissed?: boolean; done?: unknown; tips?: unknown };
    } | null;
    if (!s || ![1, 2, 3].includes(s.version ?? 0)) return DEFAULT_SETTINGS;
    return {
      version: 3,
      lang: s.lang === 'en' ? 'en' : 'ja',
      sound: s.version === 1 ? true : s.sound !== false,
      guide:
        s.version === 3 && s.guide
          ? {
              dismissed: s.guide.dismissed === true,
              done: strings(s.guide.done) as GuideProgress['done'],
              tips: strings(s.guide.tips) as GuideProgress['tips'],
            }
          : DEFAULT_GUIDE,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function loadSettings(): Settings {
  try {
    return parseSettings(localStorage.getItem(SETTINGS_KEY));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // 保存できなくても遊べる
  }
}
