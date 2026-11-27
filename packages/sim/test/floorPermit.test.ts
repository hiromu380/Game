/**
 * ランダム配置権: 抽選の決定論・パーツを動かしても結果が変わらない・置けるマス・日替わりで消える
 */
import { describe, expect, it } from 'vitest';
import {
  addItem,
  BALANCE,
  buildWeeklyConfig,
  buyOffer,
  commitShift,
  countItems,
  createRun,
  getCurrentFloor,
  getShiftFloor,
  isBlockedCell,
  isRunOp,
  placePart,
  replayOps,
  seeds,
  useFloorPermit,
  type FloorLayer,
  type RunState,
} from '../src';
import { easyShifts, withBalance } from './testBalance';

// ノルマ 1・ボスなしの6シフト（2日分）
const balance = withBalance({ shifts: easyShifts(6, 99) });

function withPermits(run: RunState, n: number): RunState {
  let state = run;
  for (let i = 0; i < n; i++) {
    const r = addItem(state, 'floorPermit');
    if (!r.ok) throw new Error(r.error);
    state = r.state;
  }
  return state;
}

function use(run: RunState): RunState {
  const r = useFloorPermit(run);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

function advance(run: RunState, times: number): RunState {
  let state = run;
  for (let i = 0; i < times; i++) {
    const floor = getCurrentFloor(state);
    if (!state.board.cells.some(Boolean)) {
      const free = floor.findIndex((c, i) => !c && i % 7 < 6 && !floor[i + 1]);
      const x = free % 7;
      const y = Math.floor(free / 7);
      const a = placePart(state, 'switch', x, y, 1);
      if (!a.ok) throw new Error(a.error);
      const b = placePart(a.state, 'dock', x + 1, y, 1);
      if (!b.ok) throw new Error(b.error);
      state = b.state;
    }
    const r = commitShift(state);
    if ('error' in r) throw new Error(r.error);
    state = r.state;
  }
  return state;
}

describe('ランダム配置権', () => {
  it('使うと配置権が1枚減り、床のないマスに床が1枚湧く（その日のうちは何枚目かで抽選が変わる）', () => {
    const run = withPermits(createRun(3), 2);
    const before = getCurrentFloor(run);
    const once = use(run);
    expect(countItems(once, 'floorPermit')).toBe(1);
    const cell = once.itemFloors!.cells[0]!;
    expect(before[cell.index]).toBeNull();
    expect(getCurrentFloor(once)[cell.index]).toEqual({ tile: cell.tile, source: 'item' });
    const twice = use(once);
    expect(twice.itemFloors!.cells).toHaveLength(2);
    expect(twice.itemFloors!.cells[1]!.index).not.toBe(cell.index);
  });

  it('同じラン・同じ日・同じ枚数目なら同じ結果（決定論）', () => {
    expect(use(withPermits(createRun(8), 1)).itemFloors).toEqual(
      use(withPermits(createRun(8), 1)).itemFloors,
    );
  });

  it('パーツを置いたり動かしたりしても、湧く位置と種類は変わらない（狙って操作できない）', () => {
    const run = withPermits(createRun(5), 1);
    const plain = use(run).itemFloors!.cells[0]!;
    // 抽選されたマスと、その周りにパーツを置いてから使う
    let crowded = run;
    const floor = getCurrentFloor(run);
    for (let i = 0; i < 49; i++) {
      if (isBlockedCell(floor, i) || crowded.board.cells[i]) continue;
      const r = placePart(crowded, 'dock', i % 7, Math.floor(i / 7), 0);
      if (r.ok) crowded = r.state;
      if (!crowded.inventory.dock) break;
    }
    expect(use(crowded).itemFloors!.cells[0]).toEqual(plain);
  });

  it('使用不可・床のあるマス（ステージ・ボーナス床）と、その日の夜の工事のマスには湧かない', () => {
    for (let seed = 1; seed <= 30; seed++) {
      let run = withPermits(createRun(seed), 3);
      const today = [0, 1, 2].map((s) => getShiftFloor(run.config, s));
      const before = getCurrentFloor(run);
      run = use(use(use(run)));
      for (const { index } of run.itemFloors!.cells) {
        expect(before[index]).toBeNull();
        for (const f of today) expect(f[index]).toBeNull();
      }
    }
  });

  it('置けるマスがなければ失敗し、配置権は減らない。1マスだけならそこに湧く', () => {
    const run = withPermits(createRun(2), 1);
    const full: FloorLayer = new Array(49).fill({ tile: 'blocked', source: 'stage' });
    const blockedAll = {
      ...run,
      bonusFloor: null,
      config: { ...run.config, stages: { ...run.config.stages!, days: [full] } },
    };
    expect(useFloorPermit(blockedAll)).toEqual({ ok: false, error: 'noCellForItem' });
    const oneFree = full.map((c, i) => (i === 17 ? null : c));
    const one = use({
      ...blockedAll,
      config: { ...run.config, stages: { ...run.config.stages!, days: [oneFree] } },
    });
    expect(one.itemFloors!.cells[0]!.index).toBe(17);
    expect(countItems(one, 'floorPermit')).toBe(0);
  });

  it('持っていなければ使えない。持てる枚数には上限がある', () => {
    expect(useFloorPermit(createRun(1))).toEqual({ ok: false, error: 'noItem' });
    const full = withPermits(createRun(1), BALANCE.floorPermit.maxHeld);
    expect(addItem(full, 'floorPermit')).toEqual({ ok: false, error: 'itemLimit' });
  });

  it('×3床は3日目から（1・2日目は ×2床と加算床だけ）', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const run = use(withPermits(createRun(seed), 1));
      expect(run.itemFloors!.cells[0]!.tile).not.toBe('triple');
    }
  });

  it('同じ日のうちはシフトをまたいで残り、日が変わると配置権も湧いた床も消える', () => {
    let run = withPermits(createRun(4, { balance }), 2);
    run = use(run);
    const index = run.itemFloors!.cells[0]!.index;
    const noon = advance(run, 1);
    expect(countItems(noon, 'floorPermit')).toBe(1);
    expect(getCurrentFloor(noon)[index]?.source).toBe('item');
    const nextMorning = advance(noon, 2);
    expect(countItems(nextMorning, 'floorPermit')).toBe(0);
    expect(nextMorning.itemFloors ?? null).toBeNull();
    expect(getCurrentFloor(nextMorning)[index]?.source).not.toBe('item');
  });

  it('シードは用途別シードのラベル9（既存の用途と重ならない）', () => {
    expect(seeds.floorPermitSeed(1, 0, 0)).not.toBe(seeds.bonusFloorSeed(1, 0));
    expect(seeds.floorPermitSeed(1, 0, 0)).not.toBe(seeds.floorPermitSeed(1, 0, 1));
  });
});

describe('ショップの配置権', () => {
  const offersPermit = (run: RunState) => run.shop.some((o) => o.itemId === 'floorPermit');

  it('品揃えの1枠として出ることがあり、1回の品揃えで最大1枠（リロールでも引き直される）', () => {
    let seen = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const run = createRun(seed);
      const permits = run.shop.filter((o) => o.itemId === 'floorPermit');
      expect(permits.length).toBeLessThanOrEqual(1);
      if (permits.length > 0) {
        seen++;
        expect(permits[0]!.price).toBe(BALANCE.floorPermit.price);
      }
    }
    // 出現率 25%（仮）: 200 シードでおおむね 30〜70 回
    expect(seen).toBeGreaterThan(20);
    expect(seen).toBeLessThan(80);
  });

  it('買うと消耗品の手持ちに入る（パーツの手持ちは増えない）。上限を超えては買えない', () => {
    const seed = Array.from({ length: 200 }, (_, i) => i + 1).find((s) =>
      offersPermit(createRun(s)),
    )!;
    const run = createRun(seed);
    const index = run.shop.findIndex((o) => o.itemId === 'floorPermit');
    const bought = buyOffer(run, index);
    if (!bought.ok) throw new Error(bought.error);
    expect(countItems(bought.state, 'floorPermit')).toBe(1);
    expect(bought.state.inventory).toEqual(run.inventory);
    expect(bought.state.budget).toBe(run.budget - BALANCE.floorPermit.price);
    const full = withPermits(run, BALANCE.floorPermit.maxHeld);
    expect(buyOffer(full, index)).toEqual({ ok: false, error: 'itemLimit' });
  });

  it('操作ログで購入・使用・日替わりの消失が再現できる', () => {
    const seed = Array.from({ length: 200 }, (_, i) => i + 1).find((s) =>
      offersPermit(createRun(s, { balance })),
    )!;
    const run = createRun(seed, { balance });
    const index = run.shop.findIndex((o) => o.itemId === 'floorPermit');
    const ops = [
      { op: 'buy', offerIndex: index },
      { op: 'useItem', itemId: 'floorPermit' },
    ];
    const replayed = replayOps(run, ops);
    if (!replayed.ok) throw new Error(replayed.error);
    const direct = use(unwrapBuy(run, index));
    expect(replayed.state.itemFloors).toEqual(direct.itemFloors);
    expect(getCurrentFloor(replayed.state)).toEqual(getCurrentFloor(direct));
    expect(isRunOp({ op: 'useItem', itemId: 'lava' })).toBe(false);
    // 翌日には消える
    expect(advance(replayed.state, 3).itemFloors ?? null).toBeNull();
  });

  it('初回ガイドのランは1日目のショップに出ない。週替わりは設定で切り替えられる', () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(offersPermit(createRun(seed, { tutorial: true }))).toBe(false);
    }
    expect(buildWeeklyConfig({ weekId: '2026-10-05' }).floorPermit).toBeDefined();
    const off = withBalance({ floorPermit: { ...BALANCE.floorPermit, inWeekly: false } });
    expect(buildWeeklyConfig({ weekId: '2026-10-05', balance: off }).floorPermit).toBeUndefined();
  });
});

function unwrapBuy(run: RunState, index: number): RunState {
  const r = buyOffer(run, index);
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
