/**
 * 多言語対応（i18n）
 *
 * 文言はすべて ja.json / en.json に置き、コードには直書きしない。
 * キーは「画面.要素」の形で意味がわかる名前にする。
 * 文中の {name} は t() の params で置き換える。
 */
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useSettings } from '../settings/SettingsContext';
import en from './en.json';
import ja from './ja.json';

export type Lang = 'ja' | 'en';
export type MessageKey = keyof typeof ja;
export type TranslateFn = (key: MessageKey, params?: Record<string, string | number>) => string;

export const MESSAGES: Record<Lang, Record<string, string>> = { ja, en };
export const DEFAULT_LANG: Lang = 'ja';

/** 文言を取り出して {name} を置き換える。見つからなければ既定言語 → キーの順にフォールバック */
export function translate(
  lang: Lang,
  key: string,
  params: Record<string, string | number> = {},
): string {
  const template = MESSAGES[lang][key] ?? MESSAGES[DEFAULT_LANG][key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: TranslateFn;
}

const I18nContext = createContext<I18nContextValue | null>(null);

/** 言語はユーザー設定の一部として保存する（settings/settingsStore.ts） */
export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings, updateSettings } = useSettings();
  const lang = settings.lang;
  const setLang = useCallback((next: Lang) => updateSettings({ lang: next }), [updateSettings]);

  const value = useMemo<I18nContextValue>(
    () => ({ lang, setLang, t: (key, params) => translate(lang, key, params) }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
