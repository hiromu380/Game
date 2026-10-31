/**
 * パーツ相場の計算（週の切り替えで呼ぶ。トリガーから独立し、単体でも実行できる）
 *
 * 週 W の相場は、前週 W-1 の週替わりチャレンジの「購入率 = 購入数 ÷ ショップ出現数」から決まり、週の間は固定する。
 * 購入数ではなく購入率で比べるのは、レアなパーツは出現が少なく、購入数だけでは不当に安くなるため。
 *
 * 何度実行しても結果は同じ（冪等）: すでに W の相場があればそれを返す。
 * 集計対象はサーバーで検証済みの挑戦の操作ログだけ（attempts.ts が shop_stats に加算したもの）。
 */
import { BALANCE, PART_IDS, type PartId } from '@chain-factory/sim';
import { MARKET_CONFIG } from '../../config/market';
import type { MarketRow, ShopStatRow } from '../../repositories/types';
import type { DomainContext } from '../context';
import { addWeeks, weekIdAt } from '../weekly/calendar';

const MILLI = 1000;

/** 相場の対象になるパーツ（ショップに並ぶもの = 価格のあるもの） */
export const MARKET_PARTS: PartId[] = PART_IDS.filter((id) => BALANCE.parts[id].price > 0);

/** 倍率（×1000 の整数）と基準価格から価格を出す。整数に丸め、最低1 */
export function priceFor(partId: PartId, multiplierMilli: number): number {
  return Math.max(1, Math.round((BALANCE.parts[partId].price * multiplierMilli) / MILLI));
}

/**
 * 前週の倍率と前週の集計から、今週の倍率を計算する（純粋関数。テストしやすいよう DB から切り離す）
 * @param previous 前週の倍率（×1000）。履歴がなければ空
 * @param stats 前週の集計
 * @param players 前週の参加人数
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

/** 指定した週の相場を用意する（なければ前週の集計から計算して保存） */
export async function ensureMarket(ctx: DomainContext, weekId: string): Promise<MarketRow[]> {
  const existing = await ctx.repos.market.get(weekId);
  if (existing) return existing;

  const previousWeek = addWeeks(weekId, -1);
  const previousRows = (await ctx.repos.market.get(previousWeek)) ?? [];
  const rows = computeMarket(
    new Map(previousRows.map((r) => [r.partId, r.multiplierMilli])),
    await ctx.repos.shopStats.get(previousWeek),
    await ctx.repos.bests.count(previousWeek),
  );
  await ctx.repos.market.put(weekId, rows);
  return rows;
}

/** 画面に出す相場（今週の価格と前週の価格）。通常ランの開始時の価格・ショップの前週比に使う */
export async function getLatestMarket(ctx: DomainContext) {
  const weekId = weekIdAt(ctx.now(), {
    offsetMinutes: ctx.config.offsetMinutes,
    weekStartDay: ctx.config.weekStartDay,
  });
  const toPrices = (rows: MarketRow[]) =>
    Object.fromEntries(rows.map((r) => [r.partId, r.price])) as Record<PartId, number>;
  const current = await ensureMarket(ctx, weekId);
  const previous = await ctx.repos.market.get(addWeeks(weekId, -1));
  return { weekId, prices: toPrices(current), previous: previous ? toPrices(previous) : null };
}
