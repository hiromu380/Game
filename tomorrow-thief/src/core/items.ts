/**
 * 道具（最大3つ装備）。効果は払い出し・賭け金上限・支配人の速さなどに効く
 *
 * 道具を買っても、すでに見た絵柄は変わらない（抽選は台のシードと位置だけで決まる）
 */
import { BALANCE, type OutcomeId } from '../config/balance';
import { basePayout } from './slot';

export type ItemId = 'boots' | 'glove' | 'mirror' | 'echo' | 'receipt' | 'contract';

export interface ItemDef {
  id: ItemId;
  price: number;
  /** 持ち帰った金額の累計がこの値以上で、時計工房に並ぶようになる */
  unlockAt: number;
}

export const ITEMS: readonly ItemDef[] = [
  { id: 'boots', price: 220, unlockAt: 0 },
  { id: 'glove', price: 420, unlockAt: 0 },
  { id: 'mirror', price: 300, unlockAt: 0 },
  { id: 'echo', price: 380, unlockAt: 0 },
  { id: 'receipt', price: 260, unlockAt: 1500 },
  { id: 'contract', price: 500, unlockAt: 6000 },
];

export const ITEM_IDS: readonly ItemId[] = ITEMS.map((i) => i.id);

export function itemDef(id: ItemId): ItemDef {
  return ITEMS.find((i) => i.id === id)!;
}

/** 払い出しの内訳（元金・払い戻し・利益を混同させないため、すべてここで計算する） */
export interface PayoutBreakdown {
  bet: number;
  /** 抽選表どおりの払い戻し（元金を含む） */
  base: number;
  /** 白紙の契約・残響コインの上乗せ分 */
  bonus: number;
  /** 受け取る総額（元金を含む） */
  total: number;
  /** 利益 = 総額 − 賭け金 */
  profit: number;
  /** 退避用の領収書で先に安全保管される分（利益の一部） */
  safe: number;
}

export function payoutFor(bet: number, outcome: OutcomeId, items: readonly ItemId[]): PayoutBreakdown {
  const base = basePayout(bet, outcome);
  let total = base;
  if (base > 0 && items.includes('contract')) {
    total = Math.floor((total * BALANCE.items.contract.payoutPercent) / 100);
  }
  if (base > 0 && base > bet && items.includes('echo')) {
    total += Math.floor((base * BALANCE.items.echo.bonusPercent) / 100);
  }
  const profit = total - bet;
  const safe =
    profit > 0 && items.includes('receipt')
      ? Math.floor((profit * BALANCE.items.receipt.safePercent) / 100)
      : 0;
  return { bet, base, bonus: total - base, total, profit, safe };
}

/** 台の賭け金上限（予知済みの抽選なら追い賭け手袋で引き上がる） */
export function betLimit(machineLimit: number, predicted: boolean, items: readonly ItemId[]): number {
  return predicted && items.includes('glove')
    ? machineLimit * BALANCE.items.glove.limitMul
    : machineLimit;
}
