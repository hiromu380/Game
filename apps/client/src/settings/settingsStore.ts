/**
 * ユーザー設定（言語・演出の強さ・揺れ・点滅・音量・初回ガイド）の保存と読み込み
 *
 * セーブデータ（ラン・メタ進行）とは別のキーに保存し、こちらにもバージョンを持たせる。
 * 形式を変えたら SETTINGS_VERSION を上げ、migrateSettings に変換を足すこと。
 */
import { EFFECTS_CONFIG, type EffectStrength } from '../config/effects';
import type { Lang } from '../i18n';
import { appStorage } from '../storage';

export const SETTINGS_VERSION = 3;
export const SETTINGS_STORAGE_KEY = 'chain-factory:settings';
/** 設定を導入する前に言語だけを保存していたキー（読み込み時に引き継ぐ） */
const LEGACY_LANG_KEY = 'chain-factory:lang';

export interface UserSettings {
  version: 3;
  lang: Lang;
  /** 演出の強さ */
  effects: EffectStrength;
  /** 画面の揺れ（酔い対策でオフにできる） */
  shake: boolean;
  /** 点滅を減らす（光過敏性への配慮。盤面の光を出さず、パーツの発光も控えめにする） */
  reduceFlashes: boolean;
  /** 音量（0〜100） */
  masterVolume: number;
  seVolume: number;
  bgmVolume: number;
  muted: boolean;
  /** 初回ガイドを終えた（または閉じた）か。false なら次の新しいランでガイドを出す */
  tutorialDone: boolean;
}

export const DEFAULT_SETTINGS: UserSettings = {
  version: 3,
  lang: 'ja',
  effects: 'full',
  shake: true,
  reduceFlashes: false,
  masterVolume: 80,
  seVolume: 80,
  bgmVolume: 60,
  muted: false,
  tutorialDone: false,
};

type SimpleStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** 既定の保存先（Web 版は localStorage、デスクトップ版はファイル。storage/index.ts） */
function defaultStorage(): SimpleStorage | null {
  return appStorage();
}

/**
 * 読み込んだ値を最新形式にする（足りない項目は既定値で補う）
 * - v1 → v2: 初回ガイド（tutorialDone）を追加。v1 のころから遊んでいた人にもガイドを1回出す
 * - v2 → v3: 点滅を減らす（reduceFlashes）を追加。既定はオフ（演出の強さ・揺れの設定はそのまま）
 */
export function migrateSettings(raw: unknown): UserSettings {
  if (typeof raw !== 'object' || raw === null) return DEFAULT_SETTINGS;
  const value = raw as Record<string, unknown>;
  if (value.version !== 1 && value.version !== 2 && value.version !== 3) return DEFAULT_SETTINGS;
  return sanitize({ ...DEFAULT_SETTINGS, ...(value as Partial<UserSettings>), version: 3 });
}

/**
 * 型や範囲の合わない項目を既定値に戻す（手で書き換えたファイル・別の版から同期された設定でも動くように。
 * 例えば演出の強さが知らない値だと、演出の長さが計算できず再生が止まる）
 */
function sanitize(settings: UserSettings): UserSettings {
  const d = DEFAULT_SETTINGS;
  const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
  const volume = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.min(100, Math.max(0, v)) : fallback;
  return {
    version: 3,
    lang: settings.lang === 'ja' || settings.lang === 'en' ? settings.lang : d.lang,
    effects: Object.hasOwn(EFFECTS_CONFIG.strength, settings.effects)
      ? settings.effects
      : d.effects,
    shake: bool(settings.shake, d.shake),
    reduceFlashes: bool(settings.reduceFlashes, d.reduceFlashes),
    masterVolume: volume(settings.masterVolume, d.masterVolume),
    seVolume: volume(settings.seVolume, d.seVolume),
    bgmVolume: volume(settings.bgmVolume, d.bgmVolume),
    muted: bool(settings.muted, d.muted),
    tutorialDone: bool(settings.tutorialDone, d.tutorialDone),
  };
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
