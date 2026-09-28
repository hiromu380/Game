/**
 * 体験版のセーブの読み出し: 製品版だけが読める（体験版からは読めない）
 */
import { IPC_CHANNELS } from '@chain-factory/shared';
import { describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/main/config';
import { createHandlers } from '../src/main/ipc/handlers';
import { unavailableSteam } from '../src/main/steam/types';

const deps = (readDemoSave: () => Promise<string | null>) => ({
  store: { readAll: async () => ({}), write: async () => {} },
  steam: unavailableSteam,
  openExternal: async () => {},
  readDemoSave,
});

describe('体験版のセーブの読み出し', () => {
  it('製品版は読める', async () => {
    const read = vi.fn(async () => '{"version":3}');
    const handlers = createHandlers(deps(read), { ...CONFIG, edition: 'full' });
    expect(await handlers[IPC_CHANNELS.readDemoSave]!()).toBe('{"version":3}');
  });

  it('体験版からは読まない', async () => {
    const read = vi.fn(async () => '{}');
    const handlers = createHandlers(deps(read), { ...CONFIG, edition: 'demo' });
    expect(await handlers[IPC_CHANNELS.readDemoSave]!()).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});
