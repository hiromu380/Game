/**
 * ゲームのウィンドウ
 *
 * - レンダラーは contextIsolation / sandbox / nodeIntegration: false（CLAUDE.md「デスクトップ版」）
 * - アプリのページ以外への遷移・新しいウィンドウは禁止。許可リストのリンクだけを既定のブラウザで開く
 * - 権限の要求（カメラ・通知など）はすべて拒否する（ゲームには不要）
 * - F11・Alt+Enter で全画面を切り替える。大きさ・位置・全画面は閉じるときに覚え、次に同じ状態で開く（windowState.ts）
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { BrowserWindow, screen, shell } from 'electron';
import { APP_ORIGIN, CONFIG } from './config';
import { isAllowedExternalUrl, isAppUrl } from './security';
import {
  isFullscreenToggle,
  keepOnScreen,
  parseWindowState,
  startFullscreen,
  WINDOW_DEFAULTS,
  type WindowState,
} from './windowState';

function readState(path: string): WindowState | null {
  try {
    return parseWindowState(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** 一時ファイルに書いてから置き換える（書き込みの途中で終了しても壊れないように）。失敗しても終了は止めない */
function writeState(path: string, state: WindowState): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(`${path}.tmp`, JSON.stringify(state));
    renameSync(`${path}.tmp`, path);
  } catch {
    // 覚えられなくても、次は既定の大きさで開くだけ
  }
}

export function createGameWindow(preloadPath: string, statePath: string): BrowserWindow {
  const saved = readState(statePath);
  const state =
    saved &&
    keepOnScreen(
      saved,
      screen.getAllDisplays().map((d) => d.workArea),
    );
  const win = new BrowserWindow({
    // Steam Deck（1280×800）でちょうど収まる大きさを既定にする
    width: state?.width ?? WINDOW_DEFAULTS.width,
    height: state?.height ?? WINDOW_DEFAULTS.height,
    ...(state?.x !== undefined && state.y !== undefined ? { x: state.x, y: state.y } : {}),
    minWidth: WINDOW_DEFAULTS.minWidth,
    minHeight: WINDOW_DEFAULTS.minHeight,
    fullscreen: startFullscreen(saved, process.env),
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
  win.once('ready-to-show', () => {
    if (state?.maximized && !win.isFullScreen()) win.maximize();
    win.show();
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (!isFullscreenToggle(input)) return;
    event.preventDefault();
    win.setFullScreen(!win.isFullScreen());
  });
  win.on('close', () => {
    const bounds = win.getNormalBounds();
    writeState(statePath, {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      maximized: win.isMaximized(),
      fullscreen: win.isFullScreen(),
    });
  });

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
