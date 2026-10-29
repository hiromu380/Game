/**
 * セーブ（localStorage）。バージョンが合わないセーブは読まない（変換は版を上げるときに足す）
 */
import { SAVE_VERSION, type GameState } from '@ichimon/sim';

const KEY = 'ichimon.save';
const SETTINGS_KEY = 'ichimon.settings';

export function loadGame(): GameState | null {
  try {
    const text = localStorage.getItem(KEY);
    if (!text) return null;
    const state = JSON.parse(text) as GameState;
    return state.version === SAVE_VERSION ? state : null;
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

export interface Settings {
  version: 1;
  lang: 'ja' | 'en';
}

export function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null') as Settings | null;
    if (s?.version === 1) return s;
  } catch {
    // 既定に戻す
  }
  return { version: 1, lang: 'ja' };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // 保存できなくても遊べる
  }
}
