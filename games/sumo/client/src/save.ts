/**
 * セーブ（localStorage）。古い版は sim の migrateSave で今の版に変換する。読めないセーブは捨てる
 */
import { migrateSave, type GameState } from '@ichimon/sim';
import type { Volume } from './sound';
import type { GuideProgress } from './guide';

const KEY = 'ichimon.save';
const SETTINGS_KEY = 'ichimon.settings';
/** 年の初め（初場所の場所前の1週目）の控え。ゲームオーバーのとき、そこからやり直せる */
const CHECKPOINT_KEY = 'ichimon.checkpoint';
/** 控えを書いた場所（同じ場所で書き直さない） */
let checkpointAt: string | null = null;

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
  if (state && isYearStart(state)) saveCheckpoint(state);
}

/** 年の初め: 初場所の場所前で、まだ何もしていない */
export function isYearStart(state: GameState): boolean {
  return !state.gameOver && state.bashoIndex % 6 === 0 && state.prep.week === 0;
}

function saveCheckpoint(state: GameState): void {
  const at = `${state.seed}:${state.bashoIndex}`;
  if (checkpointAt === at) return;
  try {
    localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(state));
    checkpointAt = at;
  } catch {
    // 入りきらなければ控えは持たない（ゲームオーバーで、やり直しを出さないだけ）
    try {
      localStorage.removeItem(CHECKPOINT_KEY);
    } catch {
      // 何もしない
    }
  }
}

/** 同じゲーム（同じシード）の、今より前の年の初めの控え。なければ null */
export function loadCheckpoint(game: GameState): GameState | null {
  try {
    const text = localStorage.getItem(CHECKPOINT_KEY);
    const c = text ? migrateSave(JSON.parse(text)) : null;
    return c && c.seed === game.seed && c.bashoIndex < game.bashoIndex ? c : null;
  } catch {
    return null;
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

/** 1: 言語 / 2: 効果音の入り切り / 3: はじめての人向けの案内の進み具合 / 4: 説明を出すか / 5: 場所前のコマンドを確かめずに決めるか / 6: 音量 */
export interface Settings {
  version: 6;
  lang: 'ja' | 'en';
  sound: boolean;
  guide: GuideProgress;
  /** 説明（注記・手引き・タブの案内）を出す。既定は出さない */
  help: boolean;
  /** 場所前のコマンドを「これで決める？」なしで、押したらすぐ決める。既定は確かめる */
  quickPrep: boolean;
  /** 音量（音を出すときの大きさ。切るのは sound） */
  volume: Volume;
}

export const DEFAULT_GUIDE: GuideProgress = { dismissed: false, done: [], tips: [] };

export const DEFAULT_SETTINGS: Settings = {
  version: 6,
  lang: 'ja',
  sound: true,
  guide: DEFAULT_GUIDE,
  help: false,
  quickPrep: false,
  volume: 'high',
};

const strings = (x: unknown): string[] =>
  Array.isArray(x) ? x.filter((v): v is string => typeof v === 'string') : [];

/** 保存した設定を読む（版1は効果音を入れ、版1・2は案内をはじめから、版3までは説明を出さない、版4までは確かめる、版5までは音量が大。壊れていれば既定） */
export function parseSettings(text: string | null): Settings {
  try {
    const s = JSON.parse(text ?? 'null') as {
      version?: number;
      lang?: 'ja' | 'en';
      sound?: boolean;
      guide?: { dismissed?: boolean; done?: unknown; tips?: unknown };
      help?: boolean;
      quickPrep?: boolean;
      volume?: string;
    } | null;
    if (!s || ![1, 2, 3, 4, 5, 6].includes(s.version ?? 0)) return DEFAULT_SETTINGS;
    const v = s.version!;
    return {
      version: 6,
      volume: v >= 6 && (s.volume === 'mid' || s.volume === 'low') ? s.volume : 'high',
      help: v >= 4 && s.help === true,
      quickPrep: v >= 5 && s.quickPrep === true,
      lang: s.lang === 'en' ? 'en' : 'ja',
      sound: s.version === 1 ? true : s.sound !== false,
      guide:
        v >= 3 && s.guide
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
