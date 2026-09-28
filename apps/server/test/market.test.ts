/**
 * パーツ相場の計算（購入率・移動平均・上下限・据え置き）と、ジョブ・デイリー・API への反映
 */
import { BALANCE, type PartId } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { MARKET_CONFIG } from '../src/config/market';
import { ensureDaily } from '../src/domain/daily/dailyJob';
import {
  computeMarket,
  ensureMarket,
  MARKET_PARTS,
  priceFor,
  runMarketJob,
} from '../src/domain/market/market';
import type { ShopStatRow } from '../src/repositories/types';
import { DAY, testApi, testContext } from './helpers';

const YESTERDAY = '2026-09-30';
const PLAYERS = MARKET_CONFIG.minPlayers;

/** 全パーツを同じ出現数・同じ購入率にした集計（一部だけ上書きできる） */
function stats(
  overrides: Partial<Record<PartId, [offered: number, bought: number]>> = {},
): ShopStatRow[] {
  return MARKET_PARTS.map((partId) => {
    const [offered, bought] = overrides[partId] ?? [100, 20];
    return { partId, offered, bought };
  });
}
const byPart = (rows: ReturnType<typeof computeMarket>) => new Map(rows.map((r) => [r.partId, r]));

describe('相場倍率の計算', () => {
  it('全パーツが同じ購入率なら倍率は 1.0 のまま', () => {
    for (const row of computeMarket(new Map(), stats(), PLAYERS)) {
      expect(row.multiplierMilli).toBe(1000);
      expect(row.price).toBe(BALANCE.parts[row.partId].price);
    }
  });

  it('よく買われるパーツは上がり、買われないパーツは下がる（移動平均でゆるやかに）', () => {
    const rows = byPart(
      computeMarket(new Map(), stats({ gear: [100, 80], coil: [100, 1] }), PLAYERS),
    );
    expect(rows.get('gear')!.multiplierMilli).toBeGreaterThan(1000);
    expect(rows.get('coil')!.multiplierMilli).toBeLessThan(1000);
    // 前日 1.0 との平均なので、1日で上限・下限には届かない
    expect(rows.get('gear')!.multiplierMilli).toBeLessThan(MARKET_CONFIG.maxMultiplier * 1000);
  });

  it('購入数ではなく購入率で比べる（出現の少ないレアも公平に扱う）', () => {
    // rebooter は出現が少ないが、出れば必ず買われる → 購入数は少なくても高くなる
    const rows = byPart(computeMarket(new Map(), stats({ rebooter: [40, 40] }), PLAYERS));
    expect(rows.get('rebooter')!.multiplierMilli).toBeGreaterThan(1000);
  });

  it('上下限で抑える', () => {
    const high = new Map<PartId, number>([['gear', 2000]]);
    const low = new Map<PartId, number>([['coil', 500]]);
    const s = stats({ gear: [100, 100], coil: [100, 0] });
    expect(byPart(computeMarket(high, s, PLAYERS)).get('gear')!.multiplierMilli).toBe(2000);
    expect(byPart(computeMarket(low, s, PLAYERS)).get('coil')!.multiplierMilli).toBe(500);
  });

  it('参加人数が閾値未満の日は据え置き（前日の倍率のまま）', () => {
    const previous = new Map<PartId, number>([['gear', 1300]]);
    const rows = byPart(computeMarket(previous, stats({ gear: [100, 100] }), PLAYERS - 1));
    expect(rows.get('gear')!.multiplierMilli).toBe(1300);
    expect(rows.get('coil')!.multiplierMilli).toBe(1000);
  });

  it('出現数が少ないパーツは据え置き', () => {
    const rows = byPart(
      computeMarket(new Map(), stats({ gear: [MARKET_CONFIG.minOffered - 1, 29] }), PLAYERS),
    );
    expect(rows.get('gear')!.multiplierMilli).toBe(1000);
  });

  it('価格は整数に丸め、最低1', () => {
    expect(priceFor('conveyor', 500)).toBe(1); // 基準1 × 0.5 = 0.5 → 1
    expect(priceFor('dock', 1500)).toBe(Math.round(BALANCE.parts.dock.price * 1.5));
  });
});

describe('相場ジョブ', () => {
  async function seedYesterday(ctx: ReturnType<typeof testContext>['ctx'], overrides = {}) {
    await ctx.repos.shopStats.add(YESTERDAY, stats(overrides));
    for (let i = 0; i < PLAYERS; i++) {
      const id = `p${i}`;
      await ctx.repos.players.create({
        id,
        tokenHash: 'h',
        displayName: id,
        hidden: false,
        createdAt: 0,
        registeredIpHash: null,
      });
      await ctx.repos.results.put({
        dailyId: YESTERDAY,
        playerId: id,
        shiftsCleared: 1,
        score: { digits: 1, head: 1, text: '1' },
        maxChain: 1,
        submittedAt: i,
      });
    }
  }

  it('前日の集計から今日の相場を作り、何度実行しても同じ（冪等）', async () => {
    const { ctx } = testContext();
    await seedYesterday(ctx, { gear: [100, 90] });
    expect(await runMarketJob(ctx)).toEqual({ date: DAY });
    const first = await ctx.repos.market.get(DAY);
    // 後から集計が増えても、作った相場は変わらない
    await ctx.repos.shopStats.add(YESTERDAY, stats({ gear: [100, 0] }));
    await runMarketJob(ctx);
    expect(await ctx.repos.market.get(DAY)).toEqual(first);
    expect(byPart(first!).get('gear')!.price).toBeGreaterThan(BALANCE.parts.gear.price);
  });

  it('デイリーの RunConfig にその日の相場価格が入る', async () => {
    const { ctx } = testContext();
    await seedYesterday(ctx, { gear: [100, 100] });
    const daily = await ensureDaily(ctx, DAY);
    const market = byPart((await ensureMarket(ctx, DAY))!);
    expect(daily.config.economy.prices.gear).toBe(market.get('gear')!.price);
  });

  it('API で今日と前日の価格を返す', async () => {
    const { ctx } = testContext();
    await ctx.repos.market.put(
      YESTERDAY,
      MARKET_PARTS.map((partId) => ({ partId, multiplierMilli: 1000, price: 9 })),
    );
    const res = await testApi(ctx).call('GET', '/market/latest');
    expect(res.status).toBe(200);
    expect(res.json.date).toBe(DAY);
    expect((res.json.previous as Record<string, number>).gear).toBe(9);
    // 前日の集計がない（参加者なし）ので今日は据え置き = 前日と同じ倍率（1.0）→ 基準価格
    expect((res.json.prices as Record<string, number>).gear).toBe(BALANCE.parts.gear.price);
  });
});
