/**
 * 経済の無限増殖の防止: 買って売る・戻して置き直す・リロールを繰り返しても、お金とパーツが増えない
 */
import {
  BALANCE,
  buyOffer,
  chooseEvent,
  commitShift,
  createPrng,
  createRun,
  getCurrentFloor,
  isBlockedCell,
  placePart,
  rerollShop,
  returnPart,
  sellPart,
  type Balance,
  type RunState,
} from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';

/** 床・パーツのない最初のマス（置けるマス） */
function freeCell(state: RunState): { x: number; y: number } | null {
  const floor = getCurrentFloor(state);
  const index = state.board.cells.findIndex((c, i) => !c && !isBlockedCell(floor, i));
  return index < 0
    ? null
    : { x: index % state.board.width, y: Math.floor(index / state.board.width) };
}

const partCount = (s: RunState) =>
  Object.values(s.inventory).reduce((n, v) => n + (v ?? 0), 0) +
  s.board.cells.filter(Boolean).length;

/** 買って置いて売る・戻す・リロールを、乱数で選びながら steps 回くり返す（1シフトのうち） */
function churn(start: RunState, seed: number, steps: number): void {
  const rng = createPrng(seed);
  let state = start;
  const budget0 = start.budget;
  const parts0 = partCount(start);
  let bought = 0;
  let spent = 0;
  /** この中で買ったパーツ（最初の手持ちは売らない。最初の手持ちの売却は元から予算になる設計のため） */
  const ownBought: Partial<Record<string, number>> = {};
  for (let i = 0; i < steps; i++) {
    const action = rng.nextInt(4);
    if (action === 0) {
      const offer = state.shop.findIndex((o) => !o.sold && o.price <= state.budget);
      if (offer < 0) continue;
      const { price, partId } = state.shop[offer]!;
      const r = buyOffer(state, offer);
      if (r.ok) {
        state = r.state;
        bought++;
        spent += price;
        ownBought[partId] = (ownBought[partId] ?? 0) + 1;
      }
    } else if (action === 1) {
      // 買ったパーツを置いてすぐ売る
      const partId = (Object.keys(ownBought) as (keyof typeof state.inventory)[]).find(
        (id) => (ownBought[id] ?? 0) > 0 && (state.inventory[id] ?? 0) > 0,
      );
      const cell = freeCell(state);
      if (!partId || !cell) continue;
      const placed = placePart(state, partId, cell.x, cell.y, 0);
      if (!placed.ok) continue;
      const sold = sellPart(placed.state, cell.x, cell.y);
      state = sold.ok ? sold.state : placed.state;
      if (sold.ok) ownBought[partId] = (ownBought[partId] ?? 0) - 1;
    } else if (action === 2) {
      const index = state.board.cells.findIndex((c) => c && c.id !== 'switch');
      if (index < 0) continue;
      const r = returnPart(state, index % state.board.width, Math.floor(index / state.board.width));
      if (r.ok) state = r.state;
    } else {
      const r = rerollShop(state);
      if (r.ok) {
        spent += state.budget - r.state.budget;
        state = r.state;
      }
    }
    // お金は最初の予算を超えない。パーツは「最初 ＋ 買った数」を超えない
    expect(state.budget).toBeLessThanOrEqual(budget0);
    expect(partCount(state)).toBeLessThanOrEqual(parts0 + bought);
    // 売却で戻るお金は、使ったお金（購入・リロール）を超えない
    expect(budget0 - state.budget).toBeLessThanOrEqual(spent);
  }
}

describe('経済の無限増殖の防止', () => {
  it('1シフトのうちに買う・置いて売る・戻す・リロールを繰り返しても、お金とパーツが増えない', () => {
    for (let seed = 1; seed <= 20; seed++) churn(createRun(seed), seed, 200);
  });

  it('在庫整理（売却 100%）の日でも、同じ日のうちの買って売るではお金が増えない', () => {
    const balance: Balance = {
      ...BALANCE,
      dayEvents: { ...BALANCE.dayEvents, candidates: ['clearance'], choices: 1 },
    };
    for (let seed = 1; seed <= 10; seed++) {
      let run = createRun(seed, { balance });
      // 1日目をノルマ 0 で進めて、2日目の朝に在庫整理を選ぶ
      run = {
        ...run,
        config: { ...run.config, shifts: run.config.shifts.map((s) => ({ ...s, quota: 0 })) },
      };
      for (let i = 0; i < 3; i++) {
        const c = commitShift(run);
        if ('error' in c) throw new Error(c.error);
        run = c.state;
      }
      const chosen = chooseEvent(run, 0);
      if (!chosen.ok) throw new Error(chosen.error);
      churn(chosen.state, seed, 200);
    }
  });
});
