/**
 * 高速化した処理が、結果を変えていないことのテスト（床の使い回し・手持ちの更新・乱数）
 */
import { describe, expect, it } from 'vitest';
import { createPrng, createRun, getCurrentFloor } from '../src';
import { addInventory } from '../src/run/inventory';

describe('そのシフトの床の使い回し', () => {
  it('同じ条件なら同じ床をそのまま返し、条件が変われば作り直す', () => {
    const run = createRun(24);
    const floor = getCurrentFloor(run);
    // 配置・購入などで状態のオブジェクトが変わっても、床に関わる部分が同じなら同じ床
    expect(getCurrentFloor({ ...run, budget: run.budget + 1 })).toBe(floor);

    // ボーナス床が変わったら作り直す（前の結果を返さない）
    const withoutBonus = getCurrentFloor({ ...run, bonusFloor: null });
    for (const cell of run.bonusFloor?.cells ?? []) {
      expect(floor[cell.index]).toEqual({ tile: cell.tile, source: 'bonus' });
      expect(withoutBonus[cell.index]).toBeNull();
    }
    // 別のシフトを挟んでも、元のシフトの床は同じ内容
    getCurrentFloor(run, run.shiftIndex + 2);
    expect(getCurrentFloor(run)).toEqual(floor);
  });

  it('別のランの床と混ざらない', () => {
    const a = createRun(1);
    const b = createRun(2);
    const floorA = JSON.stringify(getCurrentFloor(a));
    const floorB = JSON.stringify(getCurrentFloor(b));
    expect(JSON.stringify(getCurrentFloor(a))).toBe(floorA);
    expect(JSON.stringify(getCurrentFloor(b))).toBe(floorB);
  });
});

describe('手持ちの増減', () => {
  it('並び順を保ったまま増減し、0 個になったキーは消す。元の手持ちは変えない', () => {
    const inventory = { gear: 2, dock: 1, conveyor: 3 };
    expect(Object.entries(addInventory(inventory, 'dock', 2))).toEqual([
      ['gear', 2],
      ['dock', 3],
      ['conveyor', 3],
    ]);
    expect(Object.entries(addInventory(inventory, 'dock', -1))).toEqual([
      ['gear', 2],
      ['conveyor', 3],
    ]);
    expect(Object.entries(addInventory(inventory, 'press', 1))).toEqual([
      ['gear', 2],
      ['dock', 1],
      ['conveyor', 3],
      ['press', 1],
    ]);
    expect(addInventory(inventory, 'press', 0)).toEqual(inventory);
    expect(inventory).toEqual({ gear: 2, dock: 1, conveyor: 3 });
  });
});

describe('乱数（mulberry32）', () => {
  it('決まった列を返す（実装を変えても列は変えない）', () => {
    const rng = createPrng(12345);
    expect([rng.nextUint32(), rng.nextUint32(), rng.nextUint32()]).toEqual([
      4207900869, 1317490944, 2079646450,
    ]);
    expect(createPrng(0).nextInt(1000)).toBe(createPrng(0).nextUint32() % 1000);
  });
});
