/**
 * パーツ相場（通常ランの開始時の価格と、ショップの前日比の表示）
 *
 * - 起動時に1回だけ最新の相場を取りに行き、結果をこのモジュールに保持する
 * - 通常ランはオンライン時に最新の相場をラン開始時に取り込む（RunConfig に固定される）
 * - オフライン・取得失敗時は null（= 基準価格）。端末には保存しない（古い相場で遊ばないように）
 */
import type { MarketResponse } from '@chain-factory/shared';
import type { PartId } from '@chain-factory/sim';
import { api } from './api';

let latest: MarketResponse | null = null;
let loading: Promise<MarketResponse | null> | null = null;

/** 最新の相場を取りに行く（何度呼んでも通信は1回） */
export function loadMarket(): Promise<MarketResponse | null> {
  loading ??= api
    .getMarket()
    .then((market) => (latest = market))
    .catch(() => null);
  return loading;
}

/** 取得済みの相場（まだ・失敗なら null） */
export function getMarket(): MarketResponse | null {
  return latest;
}

export type PriceTrend = 'up' | 'down';

/**
 * 前日比（今日の価格と前日の価格の比較）。
 * ランの価格が今日の相場と一致するパーツだけを対象にする（古い相場で始めたランに今日の矢印を出さないため）
 */
export function priceTrends(
  market: MarketResponse | null,
  runPrices: Record<PartId, number>,
): Partial<Record<PartId, PriceTrend>> {
  const trends: Partial<Record<PartId, PriceTrend>> = {};
  if (!market?.previous) return trends;
  for (const [id, price] of Object.entries(market.prices) as [PartId, number][]) {
    const before = market.previous[id];
    if (before === undefined || runPrices[id] !== price || before === price) continue;
    trends[id] = price > before ? 'up' : 'down';
  }
  return trends;
}
