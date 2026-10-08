/**
 * 金色パーツ: 盤面で同じパーツを3つつなげると合体でき、効果の後で値を×3する
 */
import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  commitShift,
  DEFAULT_RULES,
  applyOp,
  createRun,
  getRefund,
  goldenCount,
  mergeCells,
  mergeGolden,
  isRunOp,
  placePart,
  replayOps,
  returnPart,
  scoreToString,
  sellPart,
  simulate,
  type PartId,
  type RunState,
} from '../src';
import { board } from './helpers';
import { skipEvent } from './eventHelper';
import { easyShifts, withBalance } from './testBalance';

const M = BALANCE.golden.multiplier;

/** 盤面を空にして、手持ちを指定したラン（1日目の朝。使用不可の床はない） */
function emptyRun(inventory: Partial<Record<PartId, number>>): RunState {
  const run = createRun(1);
  return {
    ...run,
    board: { ...run.board, cells: run.board.cells.map(() => null) },
    inventory,
    goldenInventory: {},
    bonusFloor: null,
  };
}

function place(state: RunState, partId: PartId, x: number, y: number, golden = false): RunState {
  const result = placePart(state, partId, x, y, 1, golden);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

const at = (state: RunState, x: number, y: number) =>
  state.board.cells[y * state.board.width + x] ?? null;

/** 合体する（できなければ例外） */
function merge(state: RunState, x: number, y: number): RunState {
  const result = mergeGolden(state, x, y);
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe('合体', () => {
  it('置いただけでは合体しない（一列に並べた組み方を崩さない）', () => {
    let run = emptyRun({ gear: 3 });
    run = place(run, 'gear', 0, 0);
    run = place(run, 'gear', 1, 0);
    run = place(run, 'gear', 2, 0);
    expect(run.board.cells.filter((c) => c?.id === 'gear')).toHaveLength(3);
    expect(run.board.cells.some((c) => c?.golden)).toBe(false);
  });

  it('3つつながったパーツを選んで合体すると、選んだマスが金色パーツになり、残り2つは消える', () => {
    let run = emptyRun({ gear: 3 });
    run = place(run, 'gear', 0, 0);
    run = place(run, 'gear', 1, 0);
    run = place(run, 'gear', 1, 1); // L 字につながる
    expect(mergeCells(run, 0, 0)).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
    run = merge(run, 0, 0);
    expect(at(run, 0, 0)).toEqual({ id: 'gear', dir: 1, golden: true });
    expect(at(run, 1, 0)).toBeNull();
    expect(at(run, 1, 1)).toBeNull();
  });

  it('2つまで・違う種類・斜めのつながりでは合体できない', () => {
    let run = emptyRun({ gear: 3, dock: 1 });
    run = place(run, 'gear', 0, 0);
    run = place(run, 'dock', 1, 0);
    run = place(run, 'gear', 2, 0);
    run = place(run, 'gear', 1, 1); // 斜めだけでつながる
    for (const [x, y] of [
      [0, 0],
      [2, 0],
      [1, 1],
      [1, 0],
      [5, 5],
      [-1, 0],
    ] as const) {
      expect(mergeCells(run, x, y)).toBeNull();
      expect(mergeGolden(run, x, y)).toEqual({ ok: false, error: 'cannotMerge' });
    }
  });

  it('スイッチ・共鳴コイルは合体しない（隣に並べるほど強いパーツとぶつからない）', () => {
    let run = emptyRun({ coil: 3 });
    run = place(run, 'coil', 0, 0);
    run = place(run, 'coil', 1, 0);
    run = place(run, 'coil', 2, 0);
    expect(mergeCells(run, 1, 0)).toBeNull();
    expect(BALANCE.golden.excluded).toEqual(expect.arrayContaining(['switch', 'coil']));
  });

  it('金色パーツどうしは合体しない（1段階だけ）・金色を挟むとつながらない', () => {
    let run: RunState = { ...emptyRun({ gear: 2 }), goldenInventory: { gear: 4 } };
    run = place(run, 'gear', 0, 0, true);
    run = place(run, 'gear', 1, 0, true);
    run = place(run, 'gear', 2, 0, true);
    expect(mergeCells(run, 1, 0)).toBeNull();
    run = place(run, 'gear', 0, 1);
    run = place(run, 'gear', 2, 1);
    run = place(run, 'gear', 1, 1, true);
    expect(mergeCells(run, 0, 1)).toBeNull();
  });

  it('つながりが4つ以上なら、選んだマスから近い順に3つを使う（決まった順）', () => {
    let run = emptyRun({ gear: 4 });
    for (let x = 0; x < 4; x++) run = place(run, 'gear', x, 0);
    run = merge(run, 1, 0); // (1,0)・(2,0)・(0,0)（上右下左の順）
    expect(at(run, 1, 0)?.golden).toBe(true);
    expect(at(run, 0, 0)).toBeNull();
    expect(at(run, 2, 0)).toBeNull();
    expect(at(run, 3, 0)).toEqual({ id: 'gear', dir: 1 });
  });

  it('金色パーツを導入する前のラン（設定に golden がない）では合体できない', () => {
    const base = emptyRun({ gear: 3 });
    let run: RunState = { ...base, config: { ...base.config, golden: undefined } };
    run = place(run, 'gear', 0, 0);
    run = place(run, 'gear', 1, 0);
    run = place(run, 'gear', 2, 0);
    expect(mergeGolden(run, 0, 0)).toEqual({ ok: false, error: 'cannotMerge' });
  });
});

describe('金色パーツの効果', () => {
  const goldenAt = (rows: string[], x: number, y: number) => {
    const b = board(rows);
    const i = y * b.width + x;
    b.cells[i] = { ...b.cells[i]!, golden: true };
    return b;
  };
  const score = (b: ReturnType<typeof board>) =>
    scoreToString(simulate({ board: b, seed: 1, rules: DEFAULT_RULES }).score);

  it('増幅ギア: ×2 の後で ×3（1マスで ×6）', () => {
    expect(score(board(['S> G> D>']))).toBe('2');
    expect(score(goldenAt(['S> G> D>'], 1, 0))).toBe(String(2 * M));
  });

  it('出荷口: 出荷量が ×3', () => {
    expect(score(goldenAt(['S> D>'], 1, 0))).toBe(String(M));
  });

  it('分岐器: 両方の枝の値が ×3', () => {
    const rows = ['.. D^ ..', 'S> Y> ..', '.. Dv ..'];
    expect(score(board(rows))).toBe('2');
    expect(score(goldenAt(rows, 1, 1))).toBe(String(2 * M));
  });

  it('貯金箱: 信号の値は ×3、収入は増えない', () => {
    const plain = simulate({ board: board(['S> $> D>']), seed: 1, rules: DEFAULT_RULES });
    const gold = simulate({ board: goldenAt(['S> $> D>'], 1, 0), seed: 1, rules: DEFAULT_RULES });
    expect(scoreToString(gold.score)).toBe(String(M));
    expect(gold.income).toBe(plain.income);
  });

  it('倍率のないルール（導入前のラン）では、金色でも効果は変わらない', () => {
    const rules = { ...DEFAULT_RULES, goldenMultiplier: undefined };
    expect(
      scoreToString(simulate({ board: goldenAt(['S> G> D>'], 1, 0), seed: 1, rules }).score),
    ).toBe('2');
  });
});

describe('手持ち・売却・日替わり・操作ログ', () => {
  it('金色パーツを手持ちに戻すと金色のまま戻り、また置ける', () => {
    let run = emptyRun({ gear: 3 });
    run = place(run, 'gear', 0, 0);
    run = place(run, 'gear', 1, 0);
    run = merge(place(run, 'gear', 2, 0), 2, 0);
    const back = returnPart(run, 2, 0);
    if (!back.ok) throw new Error(back.error);
    expect(goldenCount(back.state, 'gear')).toBe(1);
    expect(back.state.inventory.gear).toBeUndefined();
    // 普通のパーツとして置くことはできない
    expect(placePart(back.state, 'gear', 4, 4, 1)).toEqual({ ok: false, error: 'notInInventory' });
    expect(at(place(back.state, 'gear', 4, 4, true), 4, 4)?.golden).toBe(true);
  });

  it('売ると、合体した数の分の返金', () => {
    let run = emptyRun({ gear: 3 });
    run = place(run, 'gear', 0, 0);
    run = place(run, 'gear', 1, 0);
    run = merge(place(run, 'gear', 2, 0), 2, 0);
    const refund = getRefund(run, 'gear', true);
    expect(refund).toBe(getRefund(run, 'gear') * BALANCE.golden.mergeCount);
    const sold = sellPart(run, 2, 0);
    if (!sold.ok) throw new Error(sold.error);
    expect(sold.state.budget).toBe(run.budget + refund);
  });

  it('操作ログ: 合体と、金色パーツの配置（golden: true）を再生できる', () => {
    const run = emptyRun({ gear: 3 });
    const ops = [
      { op: 'place', partId: 'gear', x: 0, y: 0, dir: 1 },
      { op: 'place', partId: 'gear', x: 1, y: 0, dir: 1 },
      { op: 'place', partId: 'gear', x: 2, y: 0, dir: 1 },
      { op: 'merge', x: 2, y: 0 },
      { op: 'return', x: 2, y: 0 },
      { op: 'place', partId: 'gear', x: 3, y: 3, dir: 2, golden: true },
    ];
    const replayed = replayOps(run, ops);
    expect(replayed.ok && at(replayed.state, 3, 3)).toEqual({ id: 'gear', dir: 2, golden: true });
    expect(isRunOp({ op: 'place', partId: 'gear', x: 0, y: 0, dir: 1, golden: false })).toBe(false);
    expect(isRunOp({ op: 'place', partId: 'gear', x: 0, y: 0, dir: 1, golden: 'yes' })).toBe(false);
    expect(applyOp(run, { op: 'place', partId: 'gear', x: 0, y: 0, dir: 1, golden: true })).toEqual(
      { ok: false, error: 'notInInventory' },
    );
  });

  it('日が変わって盤面を片付けると、金色パーツは金色のまま手持ちに戻る', () => {
    const base = createRun(1, { balance: withBalance({ shifts: easyShifts(6, 99) }) });
    let run: RunState = {
      ...base,
      board: { ...base.board, cells: base.board.cells.map(() => null) },
      inventory: { switch: 1, gear: 3, dock: 1 },
    };
    run = place(run, 'switch', 0, 3);
    run = place(run, 'gear', 2, 2);
    run = place(run, 'gear', 2, 3);
    run = merge(place(run, 'gear', 1, 3), 1, 3); // (1,3)・(2,3)・(2,2) で合体し、(1,3) が金色に
    run = place(run, 'dock', 2, 3);
    for (let i = 0; i < base.config.shiftsPerDay; i++) {
      const committed = commitShift(skipEvent(run));
      if ('error' in committed) throw new Error(committed.error);
      run = committed.state;
    }
    expect(run.board.cells.every((c) => c === null)).toBe(true);
    expect(goldenCount(run, 'gear')).toBe(1);
    expect(run.inventory.gear).toBeUndefined();
  });

  it('RunConfig に合体の設定（balance/ の写し）を持つ', () => {
    expect(createRun(1).config.golden).toEqual({
      mergeCount: BALANCE.golden.mergeCount,
      excluded: BALANCE.golden.excluded,
    });
    expect(createRun(1).config.rules.goldenMultiplier).toBe(M);
  });
});
