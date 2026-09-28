/**
 * テスト用の共通部品: メモリ DB・固定の時計・API 呼び出し
 */
import { SIM_VERSION, type RunOp } from '@chain-factory/sim';
import { allowAll, type RateLimiter } from '../src/adapters/rateLimiter';
import { createApp } from '../src/app';
import type { DomainContext } from '../src/domain/context';
import type { AppConfig } from '../src/env';
import { createMemoryRepositories } from '../src/repositories/memory';
import type { Repositories } from '../src/repositories/types';

export const TEST_CONFIG: AppConfig = {
  masterSecret: 'test-master-secret-0123456789abcdef0123456789',
  dailyOffsetMinutes: 540,
  dailyEpoch: '2026-10-01',
  corsOrigins: [],
};

/** 2026-10-01 12:00 JST */
export const NOON = Date.parse('2026-10-01T03:00:00Z');
export const DAY = '2026-10-01';

export function testContext(repos: Repositories = createMemoryRepositories()) {
  const clock = { now: NOON };
  const ctx: DomainContext = { repos, config: TEST_CONFIG, now: () => clock.now };
  return { ctx, clock };
}

/** API をリクエスト単位で呼べるテスト用クライアント */
export function testApi(
  ctx: DomainContext,
  limiters: { read?: RateLimiter; write?: RateLimiter } = {},
) {
  const app = createApp({
    resolveDeps: () => ({
      ctx,
      readLimiter: limiters.read ?? allowAll,
      writeLimiter: limiters.write ?? allowAll,
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
      (await call('POST', '/players')).json as { token: string; playerId: string },
    commit: (token: string, shiftIndex: number, ops: RunOp[], simVersion = SIM_VERSION) =>
      call('POST', `/daily/${DAY}/commit`, { simVersion, shiftIndex, ops }, token),
  };
}
