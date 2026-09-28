/**
 * エントリーポイント
 *
 * 最初に読み込むのはタイトル画面まで（React・文言・設定）。ゲーム本体は Root が遅延読み込みする。
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerServiceWorker } from './boot/serviceWorker';
import { I18nProvider } from './i18n';
import { Root } from './Root';
import { SettingsProvider } from './settings/SettingsContext';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <I18nProvider>
        <Root />
      </I18nProvider>
    </SettingsProvider>
  </StrictMode>,
);

registerServiceWorker();
