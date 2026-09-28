/**
 * デスクトップ版のメインプロセスの入口
 *
 * 起動の順番:
 *   1. ユーザーデータのフォルダを決める（製品版と体験版で分ける）
 *   2. Steam を初期化する（失敗してもオフラインで続ける。本番ビルドで Steam 以外から起動されたら Steam 経由で起動し直す）
 *   3. app:// を登録してページを配信する（CSP つき）
 *   4. IPC を登録してウィンドウを開く
 */
import { ACHIEVEMENT_IDS } from '@chain-factory/sim';
import { app, ipcMain, protocol, shell } from 'electron';
import { join } from 'node:path';
import { APP_SCHEME, CONFIG } from './config';
import { createHandlers, registerHandlers } from './ipc/handlers';
import { serveAppFile } from './protocol';
import { contentSecurityPolicy } from './security';
import { startSteam } from './steam/steamworksAdapter';
import { unavailableSteam, type SteamAdapter } from './steam/types';
import { FileStore } from './storage/fileStore';
import { createGameWindow } from './window';

/** Steam のコールバックを処理する間隔（ミリ秒）。Web API チケットの受け取りなどに必要 */
const STEAM_CALLBACK_INTERVAL_MS = 100;

// app:// を標準のスキーム（オリジンを持ち、fetch・Cookie なしの安全なスキーム）として扱う。ready より前に呼ぶ必要がある
protocol.registerSchemesAsPrivileged([
  { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

// セーブの置き場所: %APPDATA%/<dataFolder>（Steam Auto-Cloud の設定と合わせる: docs/ops/steam-cloud.md）
app.setPath('userData', join(app.getPath('appData'), CONFIG.dataFolder));

/** アプリに同梱したファイルの場所（ASAR から出したファイルは app.asar.unpacked にある） */
const appRoot = app.getAppPath();
const unpackedRoot = appRoot.replace(/app\.asar$/, 'app.asar.unpacked');
const rendererDir = join(appRoot, 'renderer');
const preloadPath = join(appRoot, 'dist', 'preload.cjs');

let steam: SteamAdapter = unavailableSteam;

const started = startSteam({
  appId: CONFIG.steamAppId,
  sdkPath: join(unpackedRoot, 'steamworks_sdk'),
  restartThroughSteam: CONFIG.restartThroughSteam && app.isPackaged,
});
if (started.kind === 'restarting') {
  app.quit();
} else {
  steam = started.steam;
  if (started.kind === 'unavailable') console.warn(`[steam] unavailable: ${started.reason}`);

  void app.whenReady().then(() => {
    const csp = contentSecurityPolicy(CONFIG.apiOrigin);
    protocol.handle(APP_SCHEME, (request) => serveAppFile(rendererDir, request, csp));

    registerHandlers(
      ipcMain,
      createHandlers({
        store: new FileStore(app.getPath('userData')),
        steam,
        openExternal: (url) => shell.openExternal(url),
        // 定義済みの実績だけを Steam へ送る（レンダラーが乗っ取られても任意の ID は解除できない）
        achievementIds: new Set(ACHIEVEMENT_IDS),
      }),
    );

    const timer = setInterval(() => steam.runCallbacks(), STEAM_CALLBACK_INTERVAL_MS);
    app.on('before-quit', () => {
      clearInterval(timer);
      steam.shutdown();
    });

    createGameWindow(preloadPath);
  });

  app.on('window-all-closed', () => app.quit());
}
