/**
 * ユーザー設定（言語・効果音）の共有
 */
import { createContext, useContext } from 'react';
import { DEFAULT_SETTINGS, type Settings } from './save';

export const SettingsContext = createContext<{
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}>({ settings: DEFAULT_SETTINGS, update: () => {} });

export const useSettings = () => useContext(SettingsContext);
