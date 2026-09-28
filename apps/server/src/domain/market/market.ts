/**
 * パーツ相場の計算（ジョブ関数。トリガーから独立し、単体でも実行できる）
 *
 * 日付 D の相場は、前日 D-1 のデイリーの「購入率 = 購入数 ÷ ショップ出現数」から決まる。
 * 購入数ではなく購入率で比べるのは、レアなパーツは出現が少なく、購入数だけでは不当に安くなるため。
 *
 * 何度実行しても結果は同じ（冪等）: すでに D の相場があればそれを返す。
 * 集計対象はサーバーで検証済みのデイリーの操作ログだけ（dailyService が shop_stats に加算したもの）。
 */
import { BALANCE, PART_IDS, type PartId } from '@chain-factory/sim';
import { MARKET_CONFIG } from '../../config/market';
import type { MarketRow, ShopStatRow } from '../../repositories/types';
import type { DomainContext } from '../context';
import { dailyIdAt, previousDailyId } from '../daily/calendar';

const MILLI = 1000;

/** 相場の対象になるパーツ（ショップに並ぶもの = 価格のあるもの） */
export const MARKET_PARTS: PartId[] = PART_IDS.filter((id) => BALANCE.parts[id].price > 0);

/** 倍率（×1000 の整数）と基準価格から価格を出す。整数に丸め、最低1 */
export function priceFor(partId: PartId, multiplierMilli: number): number {
  return Math.max(1, Math.round((BALANCE.parts[partId].price * multiplierMilli) / MILLI));
}

/**
 * 前日の倍率と前日の集計から、今日の倍率を計算する（純粋関数。テストしやすいよう DB から切り離す）
 * @param previous 前日の倍率（×1000）。履歴がなければ空
 * @param stats 前日の集計
 * @param players 前日のデイリーの参加人数
 */
export function computeMarket(
  previous: ReadonlyMap<PartId, number>,
  stats: readonly ShopStatRow[],
  players: number,
  config = MARKET_CONFIG,
): MarketRow[] {
  const byPart = new Map(stats.map((s) => [s.partId, s]));
  const rate = (s: ShopStatRow | undefined) =>
    s && s.offered >= config.minOffered ? s.bought / s.offered : null;

  // 平均は「十分なデータがあるパーツ」の購入率だけで取る
  const rates = MARKET_PARTS.map((id) => rate(byPart.get(id))).filter(
    (r): r is number => r !== null,
  );
  const average = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : 0;
  const enoughData = players >= config.minPlayers && average > 0;

  return MARKET_PARTS.map((partId) => {
    const before = previous.get(partId) ?? MILLI;
    const r = rate(byPart.get(partId));
    let multiplierMilli = before;
    if (enoughData && r !== null) {
      const raw = Math.pow(r / average, config.exponent);
      const smoothed = (before / MILLI) * (1 - config.smoothing) + raw * config.smoothing;
      const clamped = Math.min(config.maxMultiplier, Math.max(config.minMultiplier, smoothed));
      multiplierMilli = Math.round(clamped * MILLI);
    }
    return { partId, multiplierMilli, price: priceFor(partId, multiplierMilli) };
  });
}

/** 指定日の相場を用意する（なければ前日の集計から計算して保存） */
export async function ensureMarket(ctx: DomainContext, date: string): Promise<MarketRow[]> {
  const existing = await ctx.repos.market.get(date);
  if (existing) return existing;

  const yesterday = previousDailyId(date);
  const previousRows = (await ctx.repos.market.get(yesterday)) ?? [];
  const rows = computeMarket(
    new Map(previousRows.map((r) => [r.partId, r.multiplierMilli])),
    await ctx.repos.shopStats.get(yesterday),
    await ctx.repos.results.count(yesterday),
  );
  await ctx.repos.market.put(date, rows);
  return rows;
}

/** ジョブ本体: 今日の相場を用意する */
export async function runMarketJob(ctx: DomainContext): Promise<{ date: string }> {
  const date = dailyIdAt(ctx.now(), ctx.config.dailyOffsetMinutes);
  await ensureMarket(ctx, date);
  return { date };
}

/** 画面に出す相場（今日の価格と前日の価格） */
export async function getLatestMarket(ctx: DomainContext) {
  const date = dailyIdAt(ctx.now(), ctx.config.dailyOffsetMinutes);
  const toPrices = (rows: MarketRow[]) =>
    Object.fromEntries(rows.map((r) => [r.partId, r.price])) as Record<PartId, number>;
  const today = await ensureMarket(ctx, date);
  const yesterday = await ctx.repos.market.get(previousDailyId(date));
  return { date, prices: toPrices(today), previous: yesterday ? toPrices(yesterday) : null };
}
