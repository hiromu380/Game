/**
 * テスト用の共通部品: メモリ DB・固定の時計・API 呼び出し
 */
import { SIM_VERSION, type RunOp } from '@chain-factory/sim';
import { memoryCache } from '../src/adapters/cache';
import { alwaysHuman, type HumanVerifier } from '../src/adapters/humanCheck';
import { allowAll, type RateLimiter } from '../src/adapters/rateLimiter';
import { steamDisabled } from '../src/adapters/steamAuth';
import type { ExternalAuthProvider } from '../src/domain/players/externalAuth';
import { createApp } from '../src/app';
import type { DomainContext } from '../src/domain/context';
import type { AppConfig } from '../src/env';
import { createMemoryRepositories } from '../src/repositories/memory';
import type { Repositories } from '../src/repositories/types';

export const TEST_CONFIG: AppConfig = {
  masterSecret: 'test-master-secret-0123456789abcdef0123456789',
  offsetMinutes: 540,
  weekStartDay: 1,
  weeklyEpoch: '2026-09-28',
  devClock: false,
  corsOrigins: [],
  turnstileSecretKey: 'test-turnstile',
  ipHashRetentionDays: 30,
  steam: { apiKey: null, allowedAppIds: [], identity: 'chain-factory-api' },
};

/** 登録リクエストの本文（テストでは人間確認を alwaysHuman で通す） */
export const REGISTER_BODY = { turnstileToken: 'test-token' };

/** 2026-10-01（木）12:00 JST */
export const NOON = Date.parse('2026-10-01T03:00:00Z');
export const DAY = '2026-10-01';
/** その週（月曜始まり）の ID */
export const WEEK = '2026-09-28';
export const DAY_MS = 24 * 60 * 60 * 1000;
/** 翌週の月曜 0:00 JST（週の締め切り） */
export const WEEK_END = Date.parse('2026-10-04T15:00:00Z');

export function testContext(repos: Repositories = createMemoryRepositories()) {
  const clock = { now: NOON };
  const now = () => clock.now;
  const ctx: DomainContext = { repos, config: TEST_CONFIG, now, cache: memoryCache(now) };
  return { ctx, clock };
}

/** API をリクエスト単位で呼べるテスト用クライアント */
export function testApi(
  ctx: DomainContext,
  limiters: {
    read?: RateLimiter;
    write?: RateLimiter;
    human?: HumanVerifier;
    steam?: ExternalAuthProvider;
  } = {},
) {
  const app = createApp({
    resolveDeps: () => ({
      ctx,
      readLimiter: limiters.read ?? allowAll,
      writeLimiter: limiters.write ?? allowAll,
      humanVerifier: limiters.human ?? alwaysHuman,
      steamAuth: limiters.steam ?? steamDisabled,
    }),
  });
  const call = async (
    method: string,
    path: string,
    body?: unknown,
    token?: string,
    /** 送信元 IP（レート制限のキー） */
    ip?: string,
  ) => {
    const res = await app.request(`/api${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(ip ? { 'x-forwarded-for': ip } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  };
  return {
    call,
    register: async () =>
      (await call('POST', '/players', REGISTER_BODY)).json as { token: string; playerId: string },
    /** 今日の挑戦を始める */
    start: (token: string, week = WEEK) => call('POST', `/weekly/${week}/attempts`, {}, token),
    commit: (
      token: string,
      shiftIndex: number,
      ops: RunOp[],
      simVersion = SIM_VERSION,
      day = DAY,
    ) =>
      call(
        'POST',
        `/weekly/${WEEK}/attempts/${day}/commit`,
        { simVersion, shiftIndex, ops },
        token,
      ),
  };
}
