import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  migrateSettings,
  saveSettings,
  SETTINGS_STORAGE_KEY,
} from '../src/settings/settingsStore';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

describe('ユーザー設定', () => {
  it('バージョン付きで保存・読み込みできる', () => {
    const storage = memoryStorage();
    saveSettings({ ...DEFAULT_SETTINGS, effects: 'minimal', shake: false }, storage);
    expect(JSON.parse(storage.data.get(SETTINGS_STORAGE_KEY)!).version).toBe(3);
    expect(loadSettings(storage)).toMatchObject({ effects: 'minimal', shake: false });
  });

  it('以前の「言語だけ」の保存を引き継ぐ', () => {
    const storage = memoryStorage();
    storage.setItem('chain-factory:lang', 'en');
    expect(loadSettings(storage).lang).toBe('en');
  });

  it('足りない項目は既定値で補い、未知のバージョンは既定値に戻す', () => {
    expect(migrateSettings({ version: 3, lang: 'en' })).toEqual({
      ...DEFAULT_SETTINGS,
      lang: 'en',
    });
    expect(migrateSettings({ version: 99 })).toEqual(DEFAULT_SETTINGS);
  });

  it('v1 → v2: 設定はそのまま引き継ぎ、初回ガイドは未完了にする', () => {
    const v1 = { version: 1, lang: 'en', effects: 'reduced', shake: false, masterVolume: 30 };
    expect(migrateSettings(v1)).toEqual({
      ...DEFAULT_SETTINGS,
      lang: 'en',
      effects: 'reduced',
      shake: false,
      masterVolume: 30,
      version: 3,
      tutorialDone: false,
      reduceFlashes: false,
    });
  });

  it('v2 → v3: 設定はそのまま引き継ぎ、点滅を減らすは既定（オフ）にする', () => {
    const v2 = { version: 2, lang: 'ja', effects: 'minimal', shake: false, tutorialDone: true };
    expect(migrateSettings(v2)).toEqual({
      ...DEFAULT_SETTINGS,
      effects: 'minimal',
      shake: false,
      tutorialDone: true,
      version: 3,
      reduceFlashes: false,
    });
  });
});
