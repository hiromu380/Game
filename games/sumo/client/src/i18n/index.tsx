/**
 * 文言（ja.json・en.json）。既定は日本語
 */
import { createContext, useContext } from 'react';
import en from './en.json';
import ja from './ja.json';

export type Lang = 'ja' | 'en';
export type MessageKey = keyof typeof ja;

const TABLES: Record<Lang, Record<string, string>> = { ja, en };

export type TranslateFn = (key: MessageKey, vars?: Record<string, string | number>) => string;

export function makeT(lang: Lang): TranslateFn {
  return (key, vars) => {
    const text = TABLES[lang][key] ?? TABLES.ja[key] ?? key;
    return vars ? text.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : text;
  };
}

export const I18nContext = createContext<{ lang: Lang; t: TranslateFn }>({
  lang: 'ja',
  t: makeT('ja'),
});
export const useI18n = () => useContext(I18nContext);
