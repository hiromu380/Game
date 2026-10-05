/**
 * パーツ相場の計算（購入率・移動平均・上下限・据え置き）と、週の RunConfig・API への反映
 */
import { BALANCE, type PartId } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { MARKET_CONFIG } from '../src/config/market';
import { openWeek } from '../src/domain/weekly/weeks';
import { computeMarket, ensureMarket, MARKET_PARTS, priceFor } from '../src/domain/market/market';
import type { ShopStatRow } from '../src/repositories/types';
import { testApi, testContext, WEEK } from './helpers';

const PREVIOUS_WEEK = '2026-09-21';
const PLAYERS = MARKET_CONFIG.minPlayers;

/** 全パーツを同じ出現数・同じ購入率にした集計（一部だけ上書きできる） */
function stats(
  overrides: Partial<Record<PartId, [offered: number, bought: number]>> = {},
): ShopStatRow[] {
  return MARKET_PARTS.map((partId) => {
    const [offered, bought] = overrides[partId] ?? [1000, 200];
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
    // 前週 1.0 との平均なので、1週で上限・下限には届かない
    expect(rows.get('gear')!.multiplierMilli).toBeLessThan(MARKET_CONFIG.maxMultiplier * 1000);
  });

  it('購入数ではなく購入率で比べる（出現の少ないレアも公平に扱う）', () => {
    // rebooter は出現が少ない（購入数は他より少ない）が、出れば必ず買われる → 高くなる
    const rows = byPart(
      computeMarket(
        new Map(),
        stats({ rebooter: [MARKET_CONFIG.minOffered, MARKET_CONFIG.minOffered] }),
        PLAYERS,
      ),
    );
    expect(rows.get('rebooter')!.multiplierMilli).toBeGreaterThan(1000);
  });

  it('上下限で抑える', () => {
    const high = new Map<PartId, number>([['gear', 2000]]);
    const low = new Map<PartId, number>([['coil', 500]]);
    const s = stats({ gear: [100, 100], coil: [100, 0] });
    expect(byPart(computeMarket(high, s, PLAYERS)).get('gear')!.multiplierMilli).toBe(2000);
    expect(byPart(computeMarket(low, s, PLAYERS)).get('coil')!.multiplierMilli).toBe(500);
  });

  it('参加人数が閾値未満の週は据え置き（前週の倍率のまま）', () => {
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

describe('週の相場', () => {
  async function seedPreviousWeek(ctx: ReturnType<typeof testContext>['ctx'], overrides = {}) {
    await ctx.repos.shopStats.add(PREVIOUS_WEEK, stats(overrides));
    for (let i = 0; i < PLAYERS; i++) {
      await ctx.repos.bests.put({
        weekId: PREVIOUS_WEEK,
        playerId: `p${i}`,
        dayId: '2026-09-21',
        shiftsCleared: 1,
        score: { digits: 1, head: 1, text: '1' },
        maxChain: 1,
        submittedAt: i,
        daysPlayed: 1,
      });
    }
  }

  it('前週の集計から今週の相場を作り、何度実行しても同じ（冪等）', async () => {
    const { ctx } = testContext();
    await seedPreviousWeek(ctx, { gear: [100, 90] });
    const first = await ensureMarket(ctx, WEEK);
    // 後から集計が増えても、作った相場は変わらない
    await ctx.repos.shopStats.add(PREVIOUS_WEEK, stats({ gear: [100, 0] }));
    expect(await ensureMarket(ctx, WEEK)).toEqual(first);
    expect(byPart(first).get('gear')!.price).toBeGreaterThan(BALANCE.parts.gear.price);
  });

  it('週の RunConfig にその週の相場価格が入る', async () => {
    const { ctx } = testContext();
    await seedPreviousWeek(ctx, { gear: [100, 100] });
    const week = await openWeek(ctx, WEEK);
    const market = byPart(await ensureMarket(ctx, WEEK));
    expect(week.config?.economy.prices.gear).toBe(market.get('gear')!.price);
  });

  it('API で今週と前週の価格を返す', async () => {
    const { ctx } = testContext();
    await ctx.repos.market.put(
      PREVIOUS_WEEK,
      MARKET_PARTS.map((partId) => ({ partId, multiplierMilli: 1000, price: 9 })),
    );
    const res = await testApi(ctx).call('GET', '/market/latest');
    expect(res.status).toBe(200);
    expect(res.json.weekId).toBe(WEEK);
    expect((res.json.previous as Record<string, number>).gear).toBe(9);
    // 前週の集計がない（参加者なし）ので今週は据え置き = 前週と同じ倍率（1.0）→ 基準価格
    expect((res.json.prices as Record<string, number>).gear).toBe(BALANCE.parts.gear.price);
  });
});
