/**
 * IPC の処理（チャンネル → 処理）
 *
 * - 受け付けるのはアプリのページ（app://chain-factory）からの呼び出しだけ
 * - 引数はすべて validate.ts で検証し、不正なら何もしない（例外にしてレンダラーへ詳細を返さない）
 * - Electron の ipcMain に依存する部分（register）と、処理本体（createHandlers）を分け、本体はテストできるようにしている
 */
import { IPC_CHANNELS, type PlatformInfo, type StorageKey } from '@chain-factory/shared';
import { CONFIG, type DesktopBuildConfig } from '../config';
import { isAllowedExternalUrl, isAppUrl } from '../security';
import type { SteamAdapter } from '../steam/types';
import {
  validateAchievementId,
  validateScreenRect,
  validateStats,
  validateStorageWrite,
} from './validate';

export interface HandlerDeps {
  store: {
    readAll(): Promise<Partial<Record<StorageKey, string>>>;
    write(key: StorageKey, value: string): Promise<void>;
  };
  steam: SteamAdapter;
  /** 既定のブラウザで開く（Electron の shell.openExternal） */
  openExternal(url: string): Promise<void>;
  /** 定義済みの実績の ID（4b で sim の定義から渡す。未指定なら形だけ確かめる） */
  achievementIds?: ReadonlySet<string>;
}

type Handler = (...args: unknown[]) => Promise<unknown>;

export function createHandlers(
  deps: HandlerDeps,
  config: DesktopBuildConfig = CONFIG,
): Record<string, Handler> {
  const { store, steam } = deps;
  const isDemo = config.edition === 'demo';
  return {
    [IPC_CHANNELS.storageReadAll]: () => store.readAll(),
    [IPC_CHANNELS.storageWrite]: async (key, value) => {
      const valid = validateStorageWrite(key, value);
      if (valid) await store.write(valid.key, valid.value);
    },
    [IPC_CHANNELS.platformInfo]: async (): Promise<PlatformInfo> => ({
      edition: config.edition,
      steam: steam.available ? 'ready' : 'unavailable',
      isSteamDeck: steam.isSteamDeck(),
      appId: config.steamAppId,
    }),
    // identity はレンダラーから受け取らない（設定値だけを使う）
    [IPC_CHANNELS.authTicket]: () => steam.getWebApiTicket(config.ticketIdentity),
    [IPC_CHANNELS.unlockAchievement]: async (id) => {
      const valid = validateAchievementId(id, deps.achievementIds);
      // 体験版では実績を送らない（CLAUDE.md「Steam 連携」）
      if (!valid || isDemo) return false;
      return steam.unlockAchievement(valid);
    },
    [IPC_CHANNELS.setStats]: async (stats) => {
      const valid = validateStats(stats);
      if (!valid || isDemo) return false;
      return steam.setStats(valid);
    },
    [IPC_CHANNELS.openStore]: async () => {
      if (!steam.openStoreOverlay(config.fullGameAppId)) await deps.openExternal(config.storeUrl);
    },
    [IPC_CHANNELS.showKeyboard]: async (rect) => {
      const valid = validateScreenRect(rect);
      return valid ? steam.showKeyboard(valid) : false;
    },
    [IPC_CHANNELS.openExternal]: async (url) => {
      if (typeof url === 'string' && isAllowedExternalUrl(url, config.externalAllowList)) {
        await deps.openExternal(url);
      }
    },
  };
}

/** Electron の ipcMain に登録する。呼び出し元のフレームがアプリのページでなければ拒否する */
export function registerHandlers(
  ipcMain: {
    handle(
      channel: string,
      listener: (event: { senderFrame: { url: string } | null }, ...args: unknown[]) => unknown,
    ): void;
  },
  handlers: Record<string, Handler>,
): void {
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, (event, ...args) => {
      if (!event.senderFrame || !isAppUrl(event.senderFrame.url)) {
        throw new Error('forbidden');
      }
      return handler(...args);
    });
  }
}
