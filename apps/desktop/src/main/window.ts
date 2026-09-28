/**
 * ゲームのウィンドウ
 *
 * - レンダラーは contextIsolation / sandbox / nodeIntegration: false（CLAUDE.md「デスクトップ版」）
 * - アプリのページ以外への遷移・新しいウィンドウは禁止。許可リストのリンクだけを既定のブラウザで開く
 * - 権限の要求（カメラ・通知など）はすべて拒否する（ゲームには不要）
 */
import { BrowserWindow, shell } from 'electron';
import { APP_ORIGIN, CONFIG } from './config';
import { isAllowedExternalUrl, isAppUrl } from './security';

export function createGameWindow(preloadPath: string): BrowserWindow {
  const win = new BrowserWindow({
    // Steam Deck（1280×800）でちょうど収まる大きさを既定にする
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#1a1c20',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  });
  win.removeMenu();
  win.once('ready-to-show', () => win.show());

  win.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    // <a target="_blank"> などで開かれるリンク（X の投稿画面・ストアページ）は、許可リストなら既定のブラウザへ
    if (isAllowedExternalUrl(url, CONFIG.externalAllowList)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) =>
    callback(false),
  );

  void win.loadURL(`${APP_ORIGIN}/index.html`);
  return win;
}
