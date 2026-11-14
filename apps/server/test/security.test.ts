/**
 * セキュリティまわりのテスト: 人間確認・IP の扱い・セキュリティヘッダー・CORS
 */
import { describe, expect, it } from 'vitest';
import { turnstileVerifier, type HumanVerifier } from '../src/adapters/humanCheck';
import { hashIp, runIpPurgeJob } from '../src/domain/players/privacy';
import { NOON, REGISTER_BODY, TEST_CONFIG, testApi, testContext } from './helpers';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('人間確認（Turnstile）', () => {
  it('確認に失敗したら登録できない', async () => {
    const { ctx } = testContext();
    const never: HumanVerifier = { verify: async () => false };
    const res = await testApi(ctx, { human: never }).call('POST', '/players', REGISTER_BODY);
    expect(res).toEqual({ status: 403, json: { error: 'humanCheckFailed' } });
  });

  it('siteverify API にトークン・秘密キー・IP を送り、success を見る', async () => {
    const sent: FormData[] = [];
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      sent.push(init.body as FormData);
      const ok = (init.body as FormData).get('response') === 'good';
      return new Response(JSON.stringify({ success: ok }));
    }) as unknown as typeof fetch;
    const verifier = turnstileVerifier('secret-key', fakeFetch);
    expect(await verifier.verify('good', '203.0.113.1')).toBe(true);
    expect(await verifier.verify('bad', null)).toBe(false);
    expect(await verifier.verify('', null)).toBe(false); // 空のトークンは問い合わせずに拒否
    expect(sent).toHaveLength(2);
    expect(sent[0]!.get('secret')).toBe('secret-key');
    expect(sent[0]!.get('remoteip')).toBe('203.0.113.1');
  });

  it('公式のテスト用キーは通信せずに決まった結果を返す', async () => {
    const noNetwork = (async () => {
      throw new Error('should not be called');
    }) as unknown as typeof fetch;
    const { TURNSTILE_TEST_SECRETS } = await import('../src/adapters/humanCheck');
    expect(
      await turnstileVerifier(TURNSTILE_TEST_SECRETS.alwaysPass, noNetwork).verify('x', null),
    ).toBe(true);
    expect(
      await turnstileVerifier(TURNSTILE_TEST_SECRETS.alwaysFail, noNetwork).verify('x', null),
    ).toBe(false);
  });

  it('検証サービスに届かないときは通さない', async () => {
    const failing = (async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;
    expect(await turnstileVerifier('k', failing).verify('good', null)).toBe(false);
  });
});

describe('IP アドレスの扱い', () => {
  it('生の IP は保存せず、秘密値つきハッシュだけを保存する', async () => {
    const { ctx } = testContext();
    const api = testApi(ctx);
    const res = await api.call('POST', '/players', REGISTER_BODY, undefined, '198.51.100.7');
    const player = await ctx.repos.players.findById(res.json.playerId as string);
    expect(player?.registeredIpHash).toBe(await hashIp(TEST_CONFIG.masterSecret, '198.51.100.7'));
    expect(JSON.stringify(player)).not.toContain('198.51.100.7');
    // 秘密値が違えば別のハッシュになる（秘密値なしで総当たりしても一致しない）
    expect(await hashIp('other-secret', '198.51.100.7')).not.toBe(player?.registeredIpHash);
  });

  it('保存期間を過ぎたハッシュはジョブで消える', async () => {
    const { ctx, clock } = testContext();
    const api = testApi(ctx);
    const old = await api.call('POST', '/players', REGISTER_BODY, undefined, '192.0.2.1');
    clock.now = NOON + 20 * DAY_MS;
    const recent = await api.call('POST', '/players', REGISTER_BODY, undefined, '192.0.2.2');

    clock.now = NOON + 31 * DAY_MS; // old は31日前、recent は11日前
    expect(await runIpPurgeJob(ctx)).toEqual({ purged: 1 });
    expect(
      (await ctx.repos.players.findById(old.json.playerId as string))?.registeredIpHash,
    ).toBeNull();
    expect(
      (await ctx.repos.players.findById(recent.json.playerId as string))?.registeredIpHash,
    ).not.toBeNull();
    // もう一度実行しても何も消えない（冪等）
    expect(await runIpPurgeJob(ctx)).toEqual({ purged: 0 });
  });
});

describe('応答ヘッダー', () => {
  it('セキュリティヘッダーが付き、既定では CORS ヘッダーを出さない', async () => {
    const { ctx } = testContext();
    const { createApp } = await import('../src/app');
    const { allowAll } = await import('../src/adapters/rateLimiter');
    const { alwaysHuman } = await import('../src/adapters/humanCheck');
    const { steamDisabled } = await import('../src/adapters/steamAuth');
    const app = createApp({
      resolveDeps: () => ({
        ctx,
        readLimiter: allowAll,
        writeLimiter: allowAll,
        humanVerifier: alwaysHuman,
        steamAuth: steamDisabled,
      }),
    });
    const res = await app.request('/api/weekly/current', {
      headers: { Origin: 'https://evil.example' },
    });
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});

describe('リクエスト本文の検証', () => {
  it('匿名登録はオブジェクトと空でない Turnstile トークンを要求する', async () => {
    const { ctx } = testContext();
    const api = testApi(ctx);
    expect(await api.call('POST', '/players', null)).toEqual({
      status: 400,
      json: { error: 'badRequest' },
    });
    expect(await api.call('POST', '/players', {})).toEqual({
      status: 400,
      json: { error: 'badRequest' },
    });
  });
});
