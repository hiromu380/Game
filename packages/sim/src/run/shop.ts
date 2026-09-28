/**
 * ショップの品揃え生成（シード乱数による重み付き抽選）
 */
import { BALANCE } from '../balance';
import { createPrng } from '../core/prng';
import { PART_IDS } from '../types';
import type { ShopOffer } from './types';

export function generateShop(seed: number, balance = BALANCE): ShopOffer[] {
  const rng = createPrng(seed);
  // 出現重みが 0 のパーツ（スイッチなど）は並ばない
  const pool = PART_IDS.filter((id) => balance.parts[id].shopWeight > 0);
  const totalWeight = pool.reduce((sum, id) => sum + balance.parts[id].shopWeight, 0);

  const offers: ShopOffer[] = [];
  for (let i = 0; i < balance.shop.offersPerShift; i++) {
    let roll = rng.nextInt(totalWeight);
    let picked = pool[0]!;
    for (const id of pool) {
      roll -= balance.parts[id].shopWeight;
      if (roll < 0) {
        picked = id;
        break;
      }
    }
    offers.push({ partId: picked, price: balance.parts[picked].price, sold: false });
  }
  return offers;
}
