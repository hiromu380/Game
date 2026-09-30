/**
 * 定期ジョブの統合テスト: 実行順・冪等性・IP ハッシュの削除
 */
import { describe, expect, it } from 'vitest';
import { runScheduledJobs } from '../src/jobs/scheduled';
import { MARKET_PARTS, priceFor } from '../src/domain/market/market';
import type { DailyRecord, MarketRow } from '../src/repositories/types';
import { DAY, NOON, testContext } from './helpers';

const YESTERDAY = '2026-09-30';
const DAY_MS = 24 * 60 * 60 * 1000;

describe('定期ジョブ', () => {
  it('相場を用意してからデイリーを作り、IP ハッシュを消す。再実行しても変わらない', async () => {
    const { ctx } = testContext();
    const writes: string[] = [];
    const repos = {
      ...ctx.repos,
      dailies: {
        ...ctx.repos.dailies,
        async createIfAbsent(record: DailyRecord) {
          writes.push('daily');
          return ctx.repos.dailies.createIfAbsent(record);
        },
      },
      market: {
        ...ctx.repos.market,
        async put(date: string, rows: MarketRow[]) {
          writes.push('market');
          return ctx.repos.market.put(date, rows);
        },
      },
    };
    const jobContext = { ...ctx, repos };
    const previousMarket = MARKET_PARTS.map((partId) => {
      const multiplierMilli = partId === 'gear' ? 1500 : 1000;
      return {
        partId,
        multiplierMilli,
        price: priceFor(partId, multiplierMilli),
      };
    });
    await ctx.repos.market.put(YESTERDAY, previousMarket);
    await ctx.repos.players.create({
      id: 'expired-ip',
      tokenHash: 'token-hash',
      displayName: 'Expired',
      hidden: false,
      createdAt: NOON - (ctx.config.ipHashRetentionDays + 1) * DAY_MS,
      registeredIpHash: 'hashed-ip',
    });

    const first = await runScheduledJobs(jobContext);
    const daily = await ctx.repos.dailies.find(DAY);
    const market = await ctx.repos.market.get(DAY);

    expect(first).toEqual({ market: DAY, daily: DAY, ipHashesPurged: 1 });
    expect(writes).toEqual(['market', 'daily']);
    expect(market).toHaveLength(MARKET_PARTS.length);
    expect(market?.find((row) => row.partId === 'gear')?.price).toBe(priceFor('gear', 1500));
    expect(daily?.config.economy.prices.gear).toBe(priceFor('gear', 1500));
    expect((await ctx.repos.players.findById('expired-ip'))?.registeredIpHash).toBeNull();

    const second = await runScheduledJobs(jobContext);
    expect(second).toEqual({ market: DAY, daily: DAY, ipHashesPurged: 0 });
    expect(writes).toEqual(['market', 'daily']);
    expect(await ctx.repos.dailies.find(DAY)).toEqual(daily);
    expect(await ctx.repos.market.get(DAY)).toEqual(market);
  });
});
