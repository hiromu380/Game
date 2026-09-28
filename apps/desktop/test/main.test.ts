/**
 * デスクトップ版のメインプロセス: IPC の検証・ファイル保存・配信・セキュリティ・Steam アダプター（モック）
 */
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IPC_CHANNELS } from '@chain-factory/shared';
import { describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/main/config';
import { createHandlers, registerHandlers } from '../src/main/ipc/handlers';
import { validateScreenRect, validateStats, validateStorageWrite } from '../src/main/ipc/validate';
import { resolveAppFile, serveAppFile } from '../src/main/protocol';
import { contentSecurityPolicy, isAllowedExternalUrl, isAppUrl } from '../src/main/security';
import { startSteam } from '../src/main/steam/steamworksAdapter';
import { unavailableSteam, type SteamAdapter } from '../src/main/steam/types';
import { FileStore } from '../src/main/storage/fileStore';

const tempDir = () => mkdtemp(join(tmpdir(), 'cf-desktop-'));

describe('IPC の引数の検証', () => {
  it('保存: 許可されたキーと文字列だけ（大きすぎる値は拒否）', () => {
    expect(validateStorageWrite('chain-factory:save', '{}')).toEqual({
      key: 'chain-factory:save',
      value: '{}',
    });
    expect(validateStorageWrite('../../etc/passwd', 'x')).toBeNull();
    expect(validateStorageWrite('chain-factory:save', 42)).toBeNull();
    expect(validateStorageWrite('chain-factory:save', 'x'.repeat(1_000_001))).toBeNull();
  });

  it('統計: 定義済みの ID と 0 以上の整数だけ', () => {
    expect(validateStats({ STAT_RUNS: 3 })).toEqual({ STAT_RUNS: 3 });
    expect(validateStats({ STAT_RUNS: -1 })).toBeNull();
    expect(validateStats({ STAT_RUNS: 1.5 })).toBeNull();
    expect(validateStats({ EVIL: 1 })).toBeNull();
    expect(validateStats([1])).toBeNull();
  });

  it('画面上の矩形: 整数・範囲内だけ', () => {
    expect(validateScreenRect({ x: 1, y: 2, width: 3, height: 4 })).toEqual({
      x: 1,
      y: 2,
      width: 3,
      height: 4,
    });
    expect(validateScreenRect({ x: -1, y: 2, width: 3, height: 4 })).toBeNull();
    expect(validateScreenRect({ x: 'a', y: 2, width: 3, height: 4 })).toBeNull();
  });
});

function fakeSteam(overrides: Partial<SteamAdapter> = {}): SteamAdapter {
  return {
    ...unavailableSteam,
    available: true,
    getWebApiTicket: vi.fn(async () => 'abcd'),
    unlockAchievement: vi.fn(async () => true),
    setStats: vi.fn(async () => true),
    openStoreOverlay: vi.fn(() => true),
    ...overrides,
  };
}

describe('IPC の処理', () => {
  const store = { readAll: vi.fn(async () => ({})), write: vi.fn(async () => {}) };

  it('認証チケットの identity はレンダラーではなく設定値を使う', async () => {
    const steam = fakeSteam();
    const handlers = createHandlers({ store, steam, openExternal: vi.fn() });
    expect(await handlers[IPC_CHANNELS.authTicket]!('attacker-identity')).toBe('abcd');
    expect(steam.getWebApiTicket).toHaveBeenCalledWith(CONFIG.ticketIdentity);
  });

  it('体験版では実績・統計を送らない', async () => {
    const steam = fakeSteam();
    const handlers = createHandlers(
      { store, steam, openExternal: vi.fn() },
      { ...CONFIG, edition: 'demo' },
    );
    expect(await handlers[IPC_CHANNELS.unlockAchievement]!('ACH_FIRST_SHIP')).toBe(false);
    expect(await handlers[IPC_CHANNELS.setStats]!({ STAT_RUNS: 1 })).toBe(false);
    expect(steam.unlockAchievement).not.toHaveBeenCalled();
  });

  it('実績の ID は形と定義済みの一覧で確かめる', async () => {
    const steam = fakeSteam();
    const handlers = createHandlers({
      store,
      steam,
      openExternal: vi.fn(),
      achievementIds: new Set(['ACH_FIRST_SHIP']),
    });
    expect(await handlers[IPC_CHANNELS.unlockAchievement]!('ACH_FIRST_SHIP')).toBe(true);
    expect(await handlers[IPC_CHANNELS.unlockAchievement]!('ACH_UNKNOWN')).toBe(false);
    expect(await handlers[IPC_CHANNELS.unlockAchievement]!('drop table')).toBe(false);
  });

  it('ストア: オーバーレイが使えなければ既定のブラウザで開く', async () => {
    const openExternal = vi.fn(async () => {});
    const handlers = createHandlers({
      store,
      steam: fakeSteam({ openStoreOverlay: () => false }),
      openExternal,
    });
    await handlers[IPC_CHANNELS.openStore]!();
    expect(openExternal).toHaveBeenCalledWith(CONFIG.storeUrl);
  });

  it('外部リンクは許可リストのものだけ開く', async () => {
    const openExternal = vi.fn(async () => {});
    const handlers = createHandlers({ store, steam: unavailableSteam, openExternal });
    await handlers[IPC_CHANNELS.openExternal]!('https://x.com/intent/post?text=hi');
    await handlers[IPC_CHANNELS.openExternal]!('https://evil.example/');
    await handlers[IPC_CHANNELS.openExternal]!('file:///etc/passwd');
    expect(openExternal).toHaveBeenCalledTimes(1);
  });

  it('アプリのページ以外からの呼び出しは拒否する', async () => {
    const registered = new Map<
      string,
      (event: { senderFrame: { url: string } | null }, ...a: unknown[]) => unknown
    >();
    registerHandlers({ handle: (c, l) => void registered.set(c, l) }, { ping: async () => 'pong' });
    const call = registered.get('ping')!;
    expect(await call({ senderFrame: { url: 'app://chain-factory/index.html' } })).toBe('pong');
    expect(() => call({ senderFrame: { url: 'https://evil.example/' } })).toThrow('forbidden');
    expect(() => call({ senderFrame: null })).toThrow('forbidden');
  });
});

describe('ファイル保存', () => {
  it('同期するもの（save）と端末だけのもの（local）を分けて保存し、読み戻せる', async () => {
    const dir = await tempDir();
    const store = new FileStore(dir);
    await store.write('chain-factory:save', '{"v":1}');
    await store.write('chain-factory:online', '{"token":"t"}');
    expect(await readdir(join(dir, 'save'))).toEqual(['save.json']);
    expect(await readdir(join(dir, 'local'))).toEqual(['identity.json']);
    expect(await store.readAll()).toEqual({
      'chain-factory:save': '{"v":1}',
      'chain-factory:online': '{"token":"t"}',
    });
  });

  it('上書きは一時ファイル経由で、一時ファイルは残らない。空文字列は削除', async () => {
    const dir = await tempDir();
    const store = new FileStore(dir);
    await store.write('chain-factory:settings', 'a');
    await store.write('chain-factory:settings', 'b');
    expect(await readFile(join(dir, 'save', 'settings.json'), 'utf8')).toBe('b');
    expect(await readdir(join(dir, 'save'))).toEqual(['settings.json']);
    await store.write('chain-factory:settings', '');
    expect(await store.readAll()).toEqual({});
  });
});

describe('app:// の配信とセキュリティ', () => {
  it('配信フォルダの外は読めない', () => {
    expect(resolveAppFile('/srv/app', 'app://chain-factory/')).toBe('/srv/app/index.html');
    expect(resolveAppFile('/srv/app', 'app://chain-factory/assets/a.js')).toBe(
      '/srv/app/assets/a.js',
    );
    expect(resolveAppFile('/srv/app', 'app://chain-factory/..%2F..%2Fetc%2Fpasswd')).toBeNull();
    expect(resolveAppFile('/srv/app', 'app://other-host/index.html')).toBeNull();
  });

  it('HTML には CSP を付ける。eval・外部スクリプトは許さない', async () => {
    const dir = await tempDir();
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(dir, 'index.html'), '<html></html>');
    const res = await serveAppFile(
      dir,
      new Request('app://chain-factory/index.html'),
      contentSecurityPolicy('https://api.example'),
    );
    const csp = res.headers.get('content-security-policy')!;
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-eval');
    expect(csp).toContain("connect-src 'self' https://api.example");
    expect(
      (await serveAppFile(dir, new Request('app://chain-factory/missing.js'), '')).status,
    ).toBe(404);
  });

  it('外部リンクの許可リスト・アプリの URL の判定', () => {
    const allow = ['https://x.com/intent/post', 'https://store.steampowered.com/'];
    expect(isAllowedExternalUrl('https://x.com/intent/post?text=a', allow)).toBe(true);
    expect(isAllowedExternalUrl('http://x.com/intent/post', allow)).toBe(false);
    expect(isAllowedExternalUrl('https://x.com.evil.example/intent/post', allow)).toBe(false);
    expect(isAllowedExternalUrl('javascript:alert(1)', allow)).toBe(false);
    expect(isAppUrl('app://chain-factory/index.html')).toBe(true);
    expect(isAppUrl('app://evil/index.html')).toBe(false);
    expect(isAppUrl('https://chain-factory/')).toBe(false);
  });
});

describe('Steam アダプター（ライブラリはモック）', () => {
  const fakeLibrary = (init: boolean, restart = false) => {
    const sdk = {
      setSdkPath: vi.fn(),
      restartAppIfNecessary: vi.fn(() => restart),
      init: vi.fn(() => init),
      runCallbacks: vi.fn(),
      shutdown: vi.fn(),
      achievements: { unlockAchievement: vi.fn(async () => true) },
      stats: { setStatInt: vi.fn(async () => true) },
      user: { getAuthTicketForWebApi: vi.fn(async () => ({ success: true, ticketHex: '0a0b' })) },
      utils: {
        isSteamRunningOnSteamDeck: () => false,
        isOverlayEnabled: () => true,
        showFloatingGamepadTextInput: () => true,
      },
      overlay: { activateGameOverlayToStore: vi.fn() },
    };
    return { sdk, load: () => ({ getInstance: () => sdk }) };
  };

  it('初期化に成功すれば ready。チケットは identity を渡して16進で返す', async () => {
    const { sdk, load } = fakeLibrary(true);
    const started = startSteam({
      appId: 480,
      sdkPath: '/sdk',
      restartThroughSteam: false,
      loadLibrary: load,
    });
    expect(started.kind).toBe('ready');
    if (started.kind !== 'ready') return;
    expect(await started.steam.getWebApiTicket('chain-factory-api')).toBe('0a0b');
    expect(sdk.user.getAuthTicketForWebApi).toHaveBeenCalledWith({
      genericString: 'chain-factory-api',
    });
    expect(sdk.setSdkPath).toHaveBeenCalledWith('/sdk');
  });

  it('Steam が起動していない（初期化に失敗）・ライブラリがない場合は unavailable（ゲームは続けられる）', () => {
    expect(
      startSteam({
        appId: 480,
        sdkPath: '',
        restartThroughSteam: false,
        loadLibrary: fakeLibrary(false).load,
      }).kind,
    ).toBe('unavailable');
    const missing = startSteam({
      appId: 480,
      sdkPath: '',
      restartThroughSteam: false,
      loadLibrary: () => {
        throw new Error('Cannot find module');
      },
    });
    expect(missing.kind).toBe('unavailable');
  });

  it('本番ビルドで Steam 以外から起動されたら、Steam 経由で起動し直す', () => {
    const { load } = fakeLibrary(true, true);
    expect(
      startSteam({ appId: 480, sdkPath: '', restartThroughSteam: true, loadLibrary: load }).kind,
    ).toBe('restarting');
  });
});
