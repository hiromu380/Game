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
import { getPlatform } from './platform';
import { SettingsProvider } from './settings/SettingsContext';
import { initStorage } from './storage';
import './styles/palette.css';
import './styles.css';

// 同梱フォントの定義は大きいので、最初の表示の後に読み込む（届くまでは予備の日本語フォントで表示）
void import('./fonts');

// 保存先の準備（デスクトップ版はファイルの読み込みを待つ）が済んでから画面を作る
await initStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <I18nProvider>
        <Root />
      </I18nProvider>
    </SettingsProvider>
  </StrictMode>,
);

// PWA（オフライン対応）は Web 版だけ。デスクトップ版はファイルを同梱しているので不要
if (getPlatform().kind === 'web') registerServiceWorker();
