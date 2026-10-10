/**
 * 記録（持ち帰った合計など）とユーザー設定。どちらもバージョンを持つ（localStorage に保存）
 */

export interface SaveData {
  version: 1;
  bankedTotal: number;
  runs: number;
  escapes: number;
  captures: number;
  jackpots: number;
  bestHaul: number;
  introSeen: boolean;
}

export interface Settings {
  version: 1;
  master: number;
  bgm: number;
  se: number;
  shake: boolean;
  flash: boolean;
  afterimage: boolean;
}

const SAVE_KEY = 'tomorrow-thief:save';
const SETTINGS_KEY = 'tomorrow-thief:settings';

export const DEFAULT_SAVE: SaveData = {
  version: 1,
  bankedTotal: 0,
  runs: 0,
  escapes: 0,
  captures: 0,
  jackpots: 0,
  bestHaul: 0,
  introSeen: false,
};

export const DEFAULT_SETTINGS: Settings = {
  version: 1,
  master: 0.8,
  bgm: 0.5,
  se: 0.8,
  shake: true,
  flash: true,
  afterimage: true,
};

function read<T extends { version: number }>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...fallback };
    const parsed = JSON.parse(raw) as Partial<T>;
    if (parsed.version !== fallback.version) return { ...fallback };
    return { ...fallback, ...parsed };
  } catch {
    return { ...fallback };
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 保存できない環境（プライベートモードなど）でも遊べる
  }
}

export const loadSave = () => read(SAVE_KEY, DEFAULT_SAVE);
export const storeSave = (s: SaveData) => write(SAVE_KEY, s);
export const loadSettings = () => read(SETTINGS_KEY, DEFAULT_SETTINGS);
export const storeSettings = (s: Settings) => write(SETTINGS_KEY, s);
