/**
 * ユーザー設定（言語・演出の強さ・揺れ・音量）の保存と読み込み
 *
 * セーブデータ（ラン・メタ進行）とは別のキーに保存し、こちらにもバージョンを持たせる。
 * 形式を変えたら SETTINGS_VERSION を上げ、migrateSettings に変換を足すこと。
 */
import type { EffectStrength } from '../config/effects';
import type { Lang } from '../i18n';

export const SETTINGS_VERSION = 1;
export const SETTINGS_STORAGE_KEY = 'chain-factory:settings';
/** 設定を導入する前に言語だけを保存していたキー（読み込み時に引き継ぐ） */
const LEGACY_LANG_KEY = 'chain-factory:lang';

export interface UserSettings {
  version: 1;
  lang: Lang;
  /** 演出の強さ */
  effects: EffectStrength;
  /** 画面の揺れ（酔い対策でオフにできる） */
  shake: boolean;
  /** 音量（0〜100） */
  masterVolume: number;
  seVolume: number;
  bgmVolume: number;
  muted: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  version: 1,
  lang: 'ja',
  effects: 'full',
  shake: true,
  masterVolume: 80,
  seVolume: 80,
  bgmVolume: 60,
  muted: false,
};

type SimpleStorage = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStorage(): SimpleStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** 読み込んだ値を最新形式にする（足りない項目は既定値で補う） */
export function migrateSettings(raw: unknown): UserSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS;
  const value = raw as Partial<UserSettings>;
  if (value.version !== 1) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...value, version: 1 };
}

export function loadSettings(storage = defaultStorage()): UserSettings {
  if (!storage) return DEFAULT_SETTINGS;
  try {
    const text = storage.getItem(SETTINGS_STORAGE_KEY);
    if (text) return migrateSettings(JSON.parse(text));
    // 旧形式（言語だけ保存していた）からの引き継ぎ
    const lang = storage.getItem(LEGACY_LANG_KEY);
    return lang === 'en' || lang === 'ja' ? { ...DEFAULT_SETTINGS, lang } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: UserSettings, storage = defaultStorage()): void {
  try {
    storage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // 保存できなくても設定は画面上で反映される
  }
}
