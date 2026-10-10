/**
 * スロットの抽選（純粋な関数）
 *
 * - 台は挑戦開始時にシードを持ち、抽選位置 index の結果は (シード, index) だけで決まる
 * - 賭け金は結果に関わらない（賭け金を変えても同じ位置の絵柄は変わらない）
 * - 払い戻しは元金を含む整数（切り捨て）。表示も同じ関数で計算する
 */
import { SLOT_TABLE, type OutcomeDef, type OutcomeId } from '../config/balance';
import { createRng, hashSeed, randInt } from './rng';

export type SymbolId = 'seven' | 'bar' | 'bell' | 'cherry' | 'clock';

/** 当たりの絵柄（3つ揃い） */
export const OUTCOME_SYMBOL: Record<Exclude<OutcomeId, 'miss'>, SymbolId> = {
  jackpot: 'seven',
  big: 'bar',
  medium: 'bell',
  small: 'cherry',
};

const ALL_SYMBOLS: SymbolId[] = ['seven', 'bar', 'bell', 'cherry', 'clock'];

export interface SpinOutcome {
  outcome: OutcomeId;
  /** 3つのリールの絵柄 */
  reels: [SymbolId, SymbolId, SymbolId];
}

export function outcomeDef(id: OutcomeId): OutcomeDef {
  return SLOT_TABLE.find((o) => o.id === id)!;
}

/** 重みの合計（表示の確率の分母） */
export const TOTAL_WEIGHT = SLOT_TABLE.reduce((n, o) => n + o.weight, 0);

/** 台の抽選位置 index の結果。forced があれば（導入の壊れた台）それを使う */
export function outcomeAt(machineSeed: number, index: number, forced?: OutcomeId): SpinOutcome {
  const rng = createRng(hashSeed(machineSeed, index, 0x5107));
  let outcome: OutcomeId = 'miss';
  if (forced) {
    outcome = forced;
  } else {
    let roll = randInt(rng, TOTAL_WEIGHT);
    for (const o of SLOT_TABLE) {
      if (roll < o.weight) {
        outcome = o.id;
        break;
      }
      roll -= o.weight;
    }
  }
  return { outcome, reels: reelsFor(outcome, rng) };
}

/** 結果から絵柄を作る（ハズレは3つ揃わない並び） */
function reelsFor(outcome: OutcomeId, rng: () => number): [SymbolId, SymbolId, SymbolId] {
  if (outcome !== 'miss') {
    const s = OUTCOME_SYMBOL[outcome];
    return [s, s, s];
  }
  const a = ALL_SYMBOLS[randInt(rng, ALL_SYMBOLS.length)]!;
  const b = ALL_SYMBOLS[randInt(rng, ALL_SYMBOLS.length)]!;
  let c = ALL_SYMBOLS[randInt(rng, ALL_SYMBOLS.length)]!;
  // 3つ揃いを避ける（惜しい並びは残す）
  if (a === b && b === c) c = ALL_SYMBOLS[(ALL_SYMBOLS.indexOf(c) + 1) % ALL_SYMBOLS.length]!;
  return [a, b, c];
}

/** 払い戻し（元金を含む。切り捨て） */
export function basePayout(bet: number, outcome: OutcomeId): number {
  return Math.floor((bet * outcomeDef(outcome).payoutTenths) / 10);
}

/** 倍率の表記（例: 1.5倍） */
export function multiplierText(outcome: OutcomeId): string {
  const t = outcomeDef(outcome).payoutTenths;
  return t % 10 === 0 ? `${t / 10}` : `${Math.floor(t / 10)}.${t % 10}`;
}
