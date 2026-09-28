/**
 * ショップの品揃え生成（シード乱数による重み付き抽選）
 */
import type { EconomyConfig } from '../config/runConfig';
import { createPrng } from '../core/prng';
import type { ShopOffer } from './types';

export function generateShop(seed: number, economy: EconomyConfig): ShopOffer[] {
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
  return offers;
}
