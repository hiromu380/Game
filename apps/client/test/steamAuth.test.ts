/**
 * デスクトップ版の Steam での本人確認: 身元がなければ Steam で登録し、401 なら取り直して1回だけやり直す
 */
import type { DesktopBridge, PlatformInfo } from '@chain-factory/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const IDENTITY_KEY = 'chain-factory:online';

function memoryLocalStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

/** Steam が動いているデスクトップ版の bridge（チケットは呼ぶたびに変わる） */
function steamBridge(steam: PlatformInfo['steam'] = 'ready'): Partial<DesktopBridge> {
  let n = 0;
  return {
    info: async () => ({ edition: 'full', steam, isSteamDeck: false, appId: 480 }),
    authTicket: async () => (steam === 'ready' ? `ab${n++}` : null),
  };
}

type Handler = (path: string, init: RequestInit) => { status: number; body: unknown };

function stubFetch(handler: Handler) {
  const calls: { path: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    const path = url.replace(/^.*\/api/, '');
    calls.push({ path, init });
    const { status, body } = handler(path, init);
    return new Response(JSON.stringify(body), { status });
  });
  return calls;
}

let storage: ReturnType<typeof memoryLocalStorage>;

beforeEach(() => {
  vi.resetModules();
  storage = memoryLocalStorage();
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());

const load = async (bridge: Partial<DesktopBridge> | null) => {
  vi.stubGlobal('window', bridge ? { chainFactory: bridge } : {});
  return import('../src/online/api');
};

describe('Steam での本人確認（デスクトップ版）', () => {
  it('身元がなければ Steam のチケットで登録してから呼ぶ', async () => {
    const calls = stubFetch((path) =>
      path === '/auth/steam'
        ? { status: 200, body: { playerId: 'p1', token: 'p1.s1', displayName: 'P' } }
        : { status: 200, body: { session: { shiftIndex: 0 } } },
    );
    const { api } = await load(steamBridge());
    await api.start('2026-10-01');
    expect(calls.map((c) => c.path)).toEqual(['/auth/steam', '/daily/2026-10-01/start']);
    expect(JSON.parse(calls[0]!.init.body as string)).toEqual({ appId: 480, ticket: 'ab0' });
    expect((calls[1]!.init.headers as Record<string, string>).Authorization).toBe('Bearer p1.s1');
    expect(JSON.parse(storage.getItem(IDENTITY_KEY)!)).toMatchObject({ token: 'p1.s1' });
  });

  it('401 なら Steam で取り直して1回だけやり直す', async () => {
    storage.setItem(
      IDENTITY_KEY,
      JSON.stringify({ version: 1, playerId: 'p1', token: 'p1.old', displayName: 'P' }),
    );
    const calls = stubFetch((path, init) => {
      if (path === '/auth/steam') {
        return { status: 200, body: { playerId: 'p1', token: 'p1.new', displayName: 'P' } };
      }
      const auth = (init.headers as Record<string, string>).Authorization;
      return auth === 'Bearer p1.new'
        ? { status: 200, body: { displayName: 'ボルト' } }
        : { status: 401, body: { error: 'unauthorized' } };
    });
    const { api } = await load(steamBridge());
    expect(await api.updateName('ボルト')).toBe('ボルト');
    expect(calls.map((c) => c.path)).toEqual([
      '/players/me/name',
      '/auth/steam',
      '/players/me/name',
    ]);
    expect(JSON.parse(storage.getItem(IDENTITY_KEY)!)).toMatchObject({
      token: 'p1.new',
      displayName: 'ボルト',
    });
  });

  it('やり直しても 401 なら諦める（無限に繰り返さない）', async () => {
    storage.setItem(
      IDENTITY_KEY,
      JSON.stringify({ version: 1, playerId: 'p1', token: 'p1.old', displayName: 'P' }),
    );
    const calls = stubFetch((path) =>
      path === '/auth/steam'
        ? { status: 200, body: { playerId: 'p1', token: 'p1.new', displayName: 'P' } }
        : { status: 401, body: { error: 'unauthorized' } },
    );
    const { api } = await load(steamBridge());
    await expect(api.start('d')).rejects.toMatchObject({ code: 'unauthorized' });
    expect(calls).toHaveLength(3);
  });

  it('Steam が動いていなければ steamUnavailable（Web 版は従来どおり unauthorized）', async () => {
    stubFetch(() => ({ status: 500, body: {} }));
    const desktop = await load(steamBridge('unavailable'));
    await expect(desktop.signInWithSteam()).rejects.toMatchObject({ code: 'steamUnavailable' });
    await expect(desktop.api.start('d')).rejects.toMatchObject({ code: 'unauthorized' });

    vi.resetModules();
    const web = await load(null);
    await expect(web.api.start('d')).rejects.toMatchObject({ code: 'unauthorized' });
    expect(await web.canUseSteamAuth()).toBe(false);
  });
});
