/**
 * ショップの品揃え生成（シード乱数による重み付き抽選）
 *
 * ランダム配置権が出るランでは、パーツを並べたあと、同じ乱数で「配置権の枠があるか」を決め、
 * あれば品揃えの1枠を配置権に置き換える（1回の品揃えで最大1枠。リロールでも引き直される）
 */
import type { EconomyConfig, RunConfig } from '../config/runConfig';
import { createPrng } from '../core/prng';
import type { ShopOffer } from './types';

export function generateShop(
  seed: number,
  economy: EconomyConfig,
  floorPermit: RunConfig['floorPermit'] | null = null,
): ShopOffer[] {
  const rng = createPrng(seed);
  const pool = economy.shopPool;
  const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
  if (totalWeight <= 0) return [];

  const offers: ShopOffer[] = [];
  for (let i = 0; i < economy.offersPerShift; i++) {
    let roll = rng.nextInt(totalWeight);
    let picked = pool[0]!.partId;
    for (const entry of pool) {
      roll -= entry.weight;
      if (roll < 0) {
        picked = entry.partId;
        break;
      }
    }
    offers.push({ partId: picked, price: economy.prices[picked], sold: false });
  }
  if (floorPermit && offers.length > 0 && rng.nextInt(100) < floorPermit.offerChancePercent) {
    const slot = rng.nextInt(offers.length);
    offers[slot] = { itemId: 'floorPermit', price: floorPermit.price, sold: false };
  }
  return offers;
}

/** そのシフトのショップに配置権を出すか（出さないなら null） */
export function permitForShift(
  config: RunConfig,
  shiftIndex: number,
): RunConfig['floorPermit'] | null {
  const permit = config.floorPermit;
  return permit && shiftIndex >= permit.fromShift ? permit : null;
}
