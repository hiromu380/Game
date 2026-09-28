/**
 * Steam 認証のテスト: チケット検証のアダプター・POST /api/auth/steam・CORS（デスクトップ版のオリジン）
 */
import { describe, expect, it } from 'vitest';
import { steamTicketVerifier } from '../src/adapters/steamAuth';
import { createApp } from '../src/app';
import { allowAll } from '../src/adapters/rateLimiter';
import { alwaysHuman } from '../src/adapters/humanCheck';
import { hashSubject, type ExternalAuthProvider } from '../src/domain/players/externalAuth';
import { TEST_CONFIG, testApi, testContext } from './helpers';

const STEAM_ID = '76561198000000001';
const CONFIG = {
  apiKey: 'publisher-key',
  allowedAppIds: [480, 1000],
  identity: 'chain-factory-api',
};

/** Steam の API の代わり。呼ばれた URL を記録し、決めた応答を返す */
function fakeSteam(body: unknown, status = 200) {
  const urls: URL[] = [];
  const fetchFn = (async (url: string) => {
    urls.push(new URL(url));
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { urls, fetchFn };
}

const OK = { response: { params: { result: 'OK', steamid: STEAM_ID, publisherbanned: false } } };

describe('Steam のチケット検証（アダプター）', () => {
  it('パブリッシャーキー・App ID・チケット・identity を送り、SteamID を返す', async () => {
    const { urls, fetchFn } = fakeSteam(OK);
    const result = await steamTicketVerifier(CONFIG, fetchFn).verify({
      appId: 480,
      ticket: 'abcd',
    });
    expect(result).toEqual({ ok: true, subject: STEAM_ID });
    const url = urls[0]!;
    expect(url.origin + url.pathname).toBe(
      'https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1/',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      key: 'publisher-key',
      appid: '480',
      ticket: 'abcd',
      identity: 'chain-factory-api',
    });
  });

  it('許可リストにない App ID は問い合わせずに拒否する', async () => {
    const { urls, fetchFn } = fakeSteam(OK);
    expect(await steamTicketVerifier(CONFIG, fetchFn).verify({ appId: 999, ticket: 'ab' })).toEqual(
      {
        ok: false,
        reason: 'appIdNotAllowed',
      },
    );
    expect(urls).toHaveLength(0);
  });

  it('チケットが不正・BAN 済みなら invalidTicket', async () => {
    const error = { response: { error: { errorcode: 101, errordesc: 'Invalid ticket' } } };
    const banned = { response: { params: { ...OK.response.params, publisherbanned: true } } };
    for (const body of [error, banned, { response: {} }]) {
      const { fetchFn } = fakeSteam(body);
      expect(
        await steamTicketVerifier(CONFIG, fetchFn).verify({ appId: 480, ticket: 'ab' }),
      ).toEqual({
        ok: false,
        reason: 'invalidTicket',
      });
    }
  });

  it('キー未設定・Steam の障害・通信エラーは providerError', async () => {
    const { fetchFn } = fakeSteam(OK);
    const noKey = steamTicketVerifier({ ...CONFIG, apiKey: null }, fetchFn);
    expect(await noKey.verify({ appId: 480, ticket: 'ab' })).toEqual({
      ok: false,
      reason: 'providerError',
    });
    const down = fakeSteam({}, 503);
    expect(
      await steamTicketVerifier(CONFIG, down.fetchFn).verify({ appId: 480, ticket: 'ab' }),
    ).toEqual({ ok: false, reason: 'providerError' });
    const broken = (async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    expect(await steamTicketVerifier(CONFIG, broken).verify({ appId: 480, ticket: 'ab' })).toEqual({
      ok: false,
      reason: 'providerError',
    });
  });
});

/** チケット = SteamID の16進、という決まりで答えるテスト用のプロバイダー */
const fakeProvider: ExternalAuthProvider = {
  async verify({ appId, ticket }) {
    if (appId !== 480) return { ok: false, reason: 'appIdNotAllowed' };
    if (ticket === 'dead') return { ok: false, reason: 'providerError' };
    if (ticket === 'bad0') return { ok: false, reason: 'invalidTicket' };
    return { ok: true, subject: BigInt(`0x${ticket}`).toString() };
  },
};
const ticketOf = (steamId: string) => BigInt(steamId).toString(16);

describe('POST /api/auth/steam', () => {
  it('初回はプレイヤーを作り、2回目は同じプレイヤーに新しいトークンを発行する（前のトークンは無効）', async () => {
    const { ctx } = testContext();
    const api = testApi(ctx, { steam: fakeProvider });
    const body = { appId: 480, ticket: ticketOf(STEAM_ID) };
    const first = await api.call('POST', '/auth/steam', body);
    expect(first.status).toBe(200);
    const second = await api.call('POST', '/auth/steam', body);
    expect(second.json.playerId).toBe(first.json.playerId);
    expect(second.json.token).not.toBe(first.json.token);

    const rename = (token: unknown) =>
      api.call('PUT', '/players/me/name', { displayName: 'ボルト' }, token as string);
    expect((await rename(first.json.token)).status).toBe(401);
    expect((await rename(second.json.token)).status).toBe(200);

    const other = await api.call('POST', '/auth/steam', {
      appId: 480,
      ticket: ticketOf('76561198000000002'),
    });
    expect(other.json.playerId).not.toBe(first.json.playerId);
  });

  it('SteamID は保存せず、秘密値つきのハッシュで引く', async () => {
    const { ctx } = testContext();
    const api = testApi(ctx, { steam: fakeProvider });
    const res = await api.call('POST', '/auth/steam', { appId: 480, ticket: ticketOf(STEAM_ID) });
    const hash = await hashSubject(TEST_CONFIG.masterSecret, 'steam', STEAM_ID);
    expect(hash).not.toContain(STEAM_ID);
    expect(await ctx.repos.externalAccounts.findPlayerId('steam', hash)).toBe(res.json.playerId);
    const player = await ctx.repos.players.findById(res.json.playerId as string);
    expect(JSON.stringify(player)).not.toContain(STEAM_ID);
  });

  it('同時に初回ログインしても1人のプレイヤーにまとまる', async () => {
    const { ctx } = testContext();
    const api = testApi(ctx, { steam: fakeProvider });
    const body = { appId: 480, ticket: ticketOf(STEAM_ID) };
    const results = await Promise.all([1, 2, 3].map(() => api.call('POST', '/auth/steam', body)));
    expect(new Set(results.map((r) => r.json.playerId)).size).toBe(1);
  });

  it('形式の誤り・App ID・チケット・Steam の障害をそれぞれのエラーで返す', async () => {
    const { ctx } = testContext();
    const api = testApi(ctx, { steam: fakeProvider });
    const cases: [unknown, number, string][] = [
      [{ appId: '480', ticket: 'ab' }, 400, 'badRequest'],
      [{ appId: 480, ticket: 'not-hex' }, 400, 'badRequest'],
      [{ appId: 480, ticket: 'a'.repeat(8194) }, 400, 'badRequest'],
      [{ appId: 1, ticket: 'ab' }, 403, 'forbidden'],
      [{ appId: 480, ticket: 'bad0' }, 401, 'unauthorized'],
      [{ appId: 480, ticket: 'dead' }, 503, 'serviceUnavailable'],
    ];
    for (const [body, status, error] of cases) {
      expect(await api.call('POST', '/auth/steam', body)).toEqual({ status, json: { error } });
    }
  });
});

describe('CORS（デスクトップ版は app://chain-factory から呼ぶ）', () => {
  it('設定したオリジンにだけ許可ヘッダーを返す', async () => {
    const { ctx } = testContext();
    const app = createApp({
      resolveDeps: () => ({
        ctx,
        readLimiter: allowAll,
        writeLimiter: allowAll,
        humanVerifier: alwaysHuman,
        steamAuth: fakeProvider,
      }),
      corsOrigins: () => ['app://chain-factory'],
    });
    const preflight = (origin: string) =>
      app.request('/api/auth/steam', {
        method: 'OPTIONS',
        headers: {
          Origin: origin,
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      });
    const ok = await preflight('app://chain-factory');
    expect(ok.headers.get('access-control-allow-origin')).toBe('app://chain-factory');
    const evil = await preflight('https://evil.example');
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
  });
});
