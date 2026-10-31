import { IPC_CHANNELS } from '@chain-factory/shared';
import { describe, expect, it, vi } from 'vitest';
import { createHandlers } from '../src/main/ipc/handlers';
import { unavailableSteam } from '../src/main/steam/types';

const store = { readAll: async () => ({}), write: async () => {} };

describe('全画面の切り替え（設定画面から）', () => {
  it('ウィンドウの全画面を読み書きする', async () => {
    let full = false;
    const win = { isFullScreen: () => full, setFullScreen: vi.fn((on: boolean) => (full = on)) };
    const handlers = createHandlers({
      store,
      steam: unavailableSteam,
      openExternal: vi.fn(),
      window: () => win,
    });
    expect(await handlers[IPC_CHANNELS.getFullscreen]!()).toBe(false);
    expect(await handlers[IPC_CHANNELS.setFullscreen]!(true)).toBe(true);
    expect(win.setFullScreen).toHaveBeenCalledWith(true);
    expect(await handlers[IPC_CHANNELS.getFullscreen]!()).toBe(true);
  });

  it('真偽以外の引数・ウィンドウを開く前は何もしない', async () => {
    const win = { isFullScreen: () => false, setFullScreen: vi.fn() };
    const handlers = createHandlers({
      store,
      steam: unavailableSteam,
      openExternal: vi.fn(),
      window: () => win,
    });
    expect(await handlers[IPC_CHANNELS.setFullscreen]!('yes')).toBe(false);
    expect(win.setFullScreen).not.toHaveBeenCalled();
    const before = createHandlers({
      store,
      steam: unavailableSteam,
      openExternal: vi.fn(),
      window: () => null,
    });
    expect(await before[IPC_CHANNELS.setFullscreen]!(true)).toBe(false);
  });
});
