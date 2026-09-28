/**
 * preload: ゲーム本体（レンダラー）に公開する API
 *
 * sandbox 付きの preload で、Node の機能は使えない。公開するのは DesktopBridge（packages/shared）の関数だけで、
 * 中身はすべて ipcRenderer.invoke。ipcRenderer そのものは公開しない（任意のチャンネルを呼ばれないように）。
 */
import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type DesktopBridge } from '@chain-factory/shared';

const bridge: DesktopBridge = {
  readAll: () => ipcRenderer.invoke(IPC_CHANNELS.storageReadAll),
  write: (key, value) => ipcRenderer.invoke(IPC_CHANNELS.storageWrite, key, value),
  info: () => ipcRenderer.invoke(IPC_CHANNELS.platformInfo),
  authTicket: () => ipcRenderer.invoke(IPC_CHANNELS.authTicket),
  unlockAchievement: (id) => ipcRenderer.invoke(IPC_CHANNELS.unlockAchievement, id),
  setStats: (stats) => ipcRenderer.invoke(IPC_CHANNELS.setStats, stats),
  openStore: () => ipcRenderer.invoke(IPC_CHANNELS.openStore),
  showKeyboard: (rect) => ipcRenderer.invoke(IPC_CHANNELS.showKeyboard, rect),
  openExternal: (url) => ipcRenderer.invoke(IPC_CHANNELS.openExternal, url),
  readDemoSave: () => ipcRenderer.invoke(IPC_CHANNELS.readDemoSave),
};

contextBridge.exposeInMainWorld('chainFactory', bridge);
