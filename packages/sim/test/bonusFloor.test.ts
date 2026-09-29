/**
 * シフト開始時のボーナス床と、今日の出来事の床
 */
import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  chooseEvent,
  commitShift,
  createRun,
  getCurrentFloor,
  getShiftFloor,
  isBlockedCell,
  placePart,
  replayOps,
  seeds,
  simulate,
  type DayEventId,
  type RunState,
} from '../src';
import { easyShifts, withBalance } from './testBalance';

// ノルマ 1・ボスなしの6シフト（2日分）
const balance = withBalance({ shifts: easyShifts(6, 99) });

/** 床のない空きマスにスイッチ → 出荷口 を置く（ステージ・ボーナス床を避ける） */
function placeLine(run: RunState): RunState {
  const floor = getCurrentFloor(run);
  const w = run.board.width;
  for (let y = 0; y < run.board.height; y++) {
    for (let x = 0; x + 1 < w; x++) {
      const a = y * w + x;
      if (floor[a] || floor[a + 1] || run.board.cells[a] || run.board.cells[a + 1]) continue;
      const s = placePart(run, 'switch', x, y, 1);
      if (!s.ok) continue;
      const d = placePart(s.state, 'dock', x + 1, y, 1);
      if (d.ok) return d.state;
    }
  }
  throw new Error('置ける場所がない');
}

function advance(run: RunState, times: number): RunState {
  let state = run;
  for (let i = 0; i < times; i++) {
    if (!state.board.cells.some(Boolean)) state = placeLine(state);
    const result = commitShift(state);
    if ('error' in result) throw new Error(result.error);
    state = result.state;
  }
  return state;
}

describe('シフト開始時のボーナス床', () => {
  it('シフト開始時に1〜2枚湧き、床・パーツのないマスに、×2床か加算床で出る', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const run = createRun(seed);
      const bonus = run.bonusFloor!;
      expect(bonus.shiftIndex).toBe(0);
      expect(bonus.cells.length).toBeGreaterThanOrEqual(1);
      expect(bonus.cells.length).toBeLessThanOrEqual(2);
      const stage = getShiftFloor(run.config, 0);
      for (const cell of bonus.cells) {
        expect(stage[cell.index]).toBeNull();
        expect(['double', 'add']).toContain(cell.tile);
        expect(getCurrentFloor(run)[cell.index]).toEqual({ tile: cell.tile, source: 'bonus' });
      }
    }
  });

  it('同じランシードなら同じ位置・種類（決定論）', () => {
    expect(createRun(5).bonusFloor).toEqual(createRun(5).bonusFloor);
    const distinct = new Set(
      Array.from({ length: 20 }, (_, s) => JSON.stringify(createRun(s + 1).bonusFloor)),
    );
    expect(distinct.size).toBeGreaterThan(10);
  });

  it('そのシフトのあいだだけ有効で、次のシフトは新しく抽選する。パーツのあるマスには湧かない', () => {
    const run = placeLine(createRun(3, { balance }));
    const next = advance(run, 1);
    expect(next.bonusFloor?.shiftIndex ?? 1).toBe(1);
    // 前のシフトのボーナス床は、次のシフトの床に残らない（同じマスに新しく湧いた場合を除く）
    for (const cell of run.bonusFloor!.cells) {
      const now = getCurrentFloor(next)[cell.index];
      if (now) expect(next.bonusFloor!.cells.some((c) => c.index === cell.index)).toBe(true);
    }
    // 昼のシフトは盤面を片付けないので、パーツのあるマスは避ける
    for (const cell of next.bonusFloor?.cells ?? []) {
      expect(next.board.cells[cell.index]).toBeNull();
    }
  });

  it('ボーナス床は本番の結果に効く（×2床の上のコンベア）', () => {
    const run = createRun(1);
    const cell = run.bonusFloor!.cells[0]!;
    const w = run.board.width;
    const board = { ...run.board, cells: run.board.cells.map(() => null) } as RunState['board'];
    const x = cell.index % w;
    const y = Math.floor(cell.index / w);
    // 左からスイッチ → 床のマスのコンベア → 右に出荷口（盤面の端なら上下で組む）
    const horizontal = x > 0 && x < w - 1;
    const cells = [...board.cells];
    if (horizontal) {
      cells[cell.index - 1] = { id: 'switch', dir: 1 };
      cells[cell.index] = { id: 'conveyor', dir: 1 };
      cells[cell.index + 1] = { id: 'dock', dir: 1 };
    } else {
      cells[cell.index - w] = { id: 'switch', dir: 2 };
      cells[cell.index] = { id: 'conveyor', dir: 2 };
      cells[cell.index + w] = { id: 'dock', dir: 2 };
    }
    if (y === 0 && !horizontal) return; // 角のマス（まれ）は省略
    const result = simulate({
      board: { ...board, cells },
      floor: getCurrentFloor(run),
      seed: 1,
      rules: run.config.rules,
    });
    const expected = cell.tile === 'double' ? 2n : 1n + BigInt(BALANCE.floorParams.addAmount);
    expect(result.score).toBe(expected);
  });

  it('初回ガイドのランは1日目に湧かない（2日目から）', () => {
    const run = createRun(1, { tutorial: true, balance });
    expect(run.bonusFloor).toBeNull();
    const day2 = advance(run, 3);
    expect(day2.config.bonusFloors!.fromShift).toBe(3);
  });

  it('シードはラベル8（既存の用途と重ならない）', () => {
    expect(seeds.bonusFloorSeed(1, 0)).not.toBe(seeds.stageSeed(1, 0));
  });
});

describe('今日の出来事の床', () => {
  /** 2日目の朝に、指定したイベントだけを候補にして選んだラン */
  function chooseOnly(id: DayEventId, patch: Partial<typeof BALANCE> = {}): RunState {
    const b = withBalance({
      ...patch,
      shifts: easyShifts(6, 99),
      dayEvents: { ...BALANCE.dayEvents, candidates: [id], choices: 1 },
    });
    const morning = advance(createRun(4, { balance: b }), 3);
    const chosen = chooseEvent(morning, 0);
    if (!chosen.ok) throw new Error(chosen.error);
    return chosen.state;
  }

  it('中央の床: 中央に近い、床のないマスに×2床が湧き、その日のあいだ残る', () => {
    const run = chooseOnly('floorCenter');
    const changes = run.dayEvent!.floorChanges!;
    expect(changes).toHaveLength(1);
    const floor = getCurrentFloor(run);
    expect(floor[changes[0]!.index]).toEqual({ tile: 'double', source: 'event' });
    // 同じ日の夜まで残る
    expect(getCurrentFloor(run, 5)[changes[0]!.index]).toEqual({ tile: 'double', source: 'event' });
    const center = 3 * 7 + 3;
    if (!getShiftFloor(run.config, 3)[center]) expect(changes[0]!.index).toBe(center);
  });

  it('加算床の差し入れ: 床のないマスに加算床が2枚', () => {
    const run = chooseOnly('floorAdds');
    const changes = run.dayEvent!.floorChanges!;
    expect(changes).toHaveLength(BALANCE.dayEvents.floorAddsCount);
    for (const c of changes) {
      expect(getShiftFloor(run.config, 3)[c.index]).toBeNull();
      expect(getCurrentFloor(run)[c.index]).toEqual({ tile: 'add', source: 'event' });
    }
  });

  it('使用不可の解消: その日のステージの使用不可が1つ消え、そこに置ける', () => {
    // 2日目の帯（使用不可あり）
    const run = chooseOnly('floorRepair');
    const changes = run.dayEvent!.floorChanges!;
    expect(changes).toHaveLength(1);
    const index = changes[0]!.index;
    expect(isBlockedCell(getShiftFloor(run.config, 3), index)).toBe(true);
    expect(getCurrentFloor(run)[index]).toBeNull();
    const placed = placePart(run, 'dock', index % 7, Math.floor(index / 7), 1);
    expect(placed.ok).toBe(true);
  });

  it('使用不可のない日は「使用不可の解消」を候補にしない', () => {
    const noBlocked = withBalance({
      shifts: easyShifts(6, 99),
      stages: { ...BALANCE.stages, dayBands: [['d1Pair'], ['d1Pair']] },
      dayEvents: { ...BALANCE.dayEvents, candidates: ['floorRepair', 'supplies'], choices: 2 },
    });
    const morning = advance(createRun(4, { balance: noBlocked }), 3);
    expect(morning.dayEvent!.choices).toEqual(['supplies']);
  });

  it('操作ログの再生で、ボーナス床と出来事の床が同じになる', () => {
    const b = withBalance({
      shifts: easyShifts(6, 99),
      dayEvents: { ...BALANCE.dayEvents, candidates: ['floorAdds'], choices: 1 },
    });
    const morning = advance(createRun(8, { balance: b }), 3);
    const replayed = replayOps(morning, [{ op: 'chooseEvent', index: 0 }]);
    const direct = chooseEvent(morning, 0);
    if (!replayed.ok || !direct.ok) throw new Error('失敗');
    expect(getCurrentFloor(replayed.state)).toEqual(getCurrentFloor(direct.state));
    expect(replayed.state.bonusFloor).toEqual(direct.state.bonusFloor);
  });

  it('次の日には出来事の床が消える', () => {
    const run = chooseOnly('floorAdds');
    const index = run.dayEvent!.floorChanges![0]!.index;
    const day3 = advance(run, 3);
    expect(getCurrentFloor(day3, 6)[index]?.source).not.toBe('event');
  });
});
