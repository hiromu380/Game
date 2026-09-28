/**
 * ラン進行（シフト・予算・ショップ・リロール・移動と売却・試運転と本番）のテスト
 */
import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  buyOffer,
  commitShift,
  createRun,
  generateShop,
  getCurrentEconomy,
  getDayAndPeriod,
  getRefund,
  getRerollCost,
  placePart,
  rerollShop,
  returnPart,
  rotatePart,
  runTrial,
  seeds,
  sellPart,
  type RunActionResult,
  type RunState,
} from '../src';
import { easyShifts, withBalance } from './testBalance';

/** 成功を前提に state を取り出す */
function unwrap(result: RunActionResult): RunState {
  if (!result.ok) throw new Error(`操作に失敗: ${result.error}`);
  return result.state;
}

/** スイッチと出荷口を置いた最小構成のラン（スコア1） */
function minimalRun(seed = 1, balance = BALANCE): RunState {
  let run = createRun(seed, { balance });
  run = unwrap(placePart(run, 'switch', 0, 0, 1));
  run = unwrap(placePart(run, 'dock', 1, 0, 1));
  return run;
}

/** 手持ちにスイッチ・出荷口があれば、使えるマスに「スイッチ → 出荷口」の形で置く */
function placeSwitchAndDock(run: RunState): RunState {
  if (!run.inventory.switch && !run.inventory.dock) return run;
  // どちらか一方だけ戻された場合も、両方を戻してから置き直す
  for (let i = 0; i < run.board.cells.length; i++) {
    const part = run.board.cells[i];
    if (part?.id === 'switch' || part?.id === 'dock') {
      run = unwrap(returnPart(run, i % run.board.width, Math.floor(i / run.board.width)));
    }
  }
  const blocked = run.config.bossPlan[run.shiftIndex]?.blockedCells ?? [];
  for (let i = 0; i < run.board.cells.length - 1; i++) {
    const x = i % run.board.width;
    const y = Math.floor(i / run.board.width);
    if (x + 1 >= run.board.width || blocked.includes(i) || blocked.includes(i + 1)) continue;
    if (run.board.cells[i] || run.board.cells[i + 1]) continue;
    run = unwrap(placePart(run, 'switch', x, y, 1));
    return unwrap(placePart(run, 'dock', x + 1, y, 1));
  }
  throw new Error('置ける場所がない');
}

function commit(run: RunState) {
  const result = commitShift(run);
  if ('error' in result) throw new Error(result.error);
  return result;
}

describe('ランの開始', () => {
  it('初期予算・初期キット・ショップ・RunConfig が用意される', () => {
    const run = createRun(1);
    expect(run.shiftIndex).toBe(0);
    expect(run.phase).toBe('building');
    expect(run.budget).toBe(BALANCE.shifts[0]!.budget);
    expect(run.inventory).toEqual(BALANCE.economy.starterKit);
    expect(run.shop).toHaveLength(BALANCE.economy.offersPerShift);
    expect(run.config.shifts).toHaveLength(9);
    expect(run.board.width).toBe(BALANCE.board.width);
  });

  it('同じシードなら同じラン、違うシードなら（多くの場合）違うショップ', () => {
    expect(createRun(5)).toEqual(createRun(5));
    const shops = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(createRun(i).shop)));
    expect(shops.size).toBeGreaterThan(1);
  });

  it('ショップにはスイッチ（レア度なし）が並ばず、価格は RunConfig の値', () => {
    const economy = createRun(1).config.economy;
    for (let seed = 0; seed < 50; seed++) {
      for (const offer of generateShop(seed, economy)) {
        expect(offer.partId).not.toBe('switch');
        expect(offer.price).toBe(BALANCE.parts[offer.partId].price);
      }
    }
  });

  it('RunState は JSON で保存・復元しても同じ内容になる', () => {
    const run = createRun(3);
    expect(JSON.parse(JSON.stringify(run))).toEqual(run);
  });

  it('balance.ts を変えても、開始済みのランの設定は変わらない', () => {
    const run = createRun(1);
    const changed = withBalance({ partParams: { ...BALANCE.partParams, gearMultiplier: 99 } });
    expect(createRun(1, { balance: changed }).config.rules.params.gearMultiplier).toBe(99);
    expect(run.config.rules.params.gearMultiplier).toBe(BALANCE.partParams.gearMultiplier);
  });
});

describe('購入・配置・回転', () => {
  it('購入すると予算が減り手持ちに入る。同じ商品は2回買えない', () => {
    const run = createRun(1);
    const offer = run.shop[0]!;
    const after = unwrap(buyOffer(run, 0));
    expect(after.budget).toBe(run.budget - offer.price);
    expect(after.inventory[offer.partId]).toBe((run.inventory[offer.partId] ?? 0) + 1);
    expect(buyOffer(after, 0)).toEqual({ ok: false, error: 'alreadySold' });
  });

  it('予算が足りなければ買えない', () => {
    const run = { ...createRun(1), budget: 0 };
    const index = run.shop.findIndex((o) => o.price > 0);
    expect(buyOffer(run, index)).toEqual({ ok: false, error: 'notEnoughBudget' });
  });

  it('配置・回転ができ、手持ちがなければ置けない', () => {
    let run = minimalRun();
    expect(run.inventory).toEqual({});
    expect(placePart(run, 'dock', 2, 0, 1)).toEqual({ ok: false, error: 'notInInventory' });
    run = unwrap(rotatePart(run, 1, 0));
    expect(run.board.cells[1]).toEqual({ id: 'dock', dir: 2 });
  });
});

describe('手持ちに戻す・売却', () => {
  it('手持ちに戻すのは無料で、何度でもできる（パーツの移動）', () => {
    let run = minimalRun();
    const budget = run.budget;
    run = unwrap(returnPart(run, 1, 0));
    run = unwrap(placePart(run, 'dock', 3, 3, 1));
    run = unwrap(returnPart(run, 3, 3));
    expect(run.inventory.dock).toBe(1);
    expect(run.budget).toBe(budget);
  });

  it('売却は価格の返金率%（切り捨て）が戻り、パーツは消える', () => {
    let run = minimalRun();
    const budget = run.budget;
    run = unwrap(sellPart(run, 1, 0));
    expect(run.budget).toBe(budget + getRefund(run, 'dock'));
    expect(getRefund(run, 'dock')).toBe(
      Math.floor((BALANCE.parts.dock.price * BALANCE.economy.refundPercent) / 100),
    );
    expect(run.inventory.dock).toBeUndefined();
  });

  it('スイッチ（価格0）は売却できない', () => {
    expect(sellPart(minimalRun(), 0, 0)).toEqual({ ok: false, error: 'cannotSell' });
  });
});

describe('リロール', () => {
  it('リロールするたびに品揃えが変わり、価格が上がる', () => {
    let run = createRun(1);
    const cost1 = getRerollCost(run)!;
    const before = run.budget;
    run = unwrap(rerollShop(run));
    expect(run.budget).toBe(before - cost1);
    expect(run.rerollCount).toBe(1);
    expect(getRerollCost(run)).toBe(cost1 + BALANCE.economy.reroll.costStep);
    expect(run.shop).toEqual(generateShop(seeds.shopSeed(run.seed, 0, 1), getCurrentEconomy(run)));
  });

  it('予算が足りなければリロールできない', () => {
    expect(rerollShop({ ...createRun(1), budget: 0 })).toEqual({
      ok: false,
      error: 'notEnoughBudget',
    });
  });
});

describe('試運転と本番', () => {
  it('試運転は盤面を変えず、試運転回数だけ増える', () => {
    const run = minimalRun();
    const { state, result } = runTrial(run);
    expect(state).toEqual({ ...run, trialCount: 1 });
    expect(result.score).toBe(1n);
  });

  it('試運転ごとにシードが変わり、本番シードとは一致しない', () => {
    const trialSeeds = new Set(Array.from({ length: 10 }, (_, i) => seeds.trialSeed(1, 0, i)));
    expect(trialSeeds.size).toBe(10);
    expect(trialSeeds.has(seeds.commitSeed(1, 0))).toBe(false);
  });

  it('決定論的な配置なら、試運転と本番の結果は同じ', () => {
    const run = minimalRun();
    expect(runTrial(run).result.score).toBe(commit(run).result.score);
  });

  it('ポンコツロボの結果は試運転ごとに変わりうるが、本番は同じ入力なら必ず同じ', () => {
    // 出荷口で囲んだポンコツロボ: 向きによって出荷されるかどうかが変わる
    let run = createRun(1, {
      balance: withBalance({
        economy: { ...BALANCE.economy, starterKit: { switch: 1, dock: 3, junkbot: 1 } },
      }),
    });
    run = unwrap(placePart(run, 'switch', 1, 2, 0));
    run = unwrap(placePart(run, 'junkbot', 1, 1, 0));
    run = unwrap(placePart(run, 'dock', 1, 0, 0));
    run = unwrap(placePart(run, 'dock', 0, 1, 0));
    run = unwrap(placePart(run, 'dock', 2, 1, 0));

    const trialScores = new Set<bigint>();
    let state = run;
    for (let i = 0; i < 20; i++) {
      const trial = runTrial(state);
      trialScores.add(trial.result.score);
      state = trial.state;
    }
    expect(trialScores.size).toBeGreaterThan(1);
    expect(commit(run).result).toEqual(commit(state).result);
  });
});

describe('シフトの確定とノルマ', () => {
  it('ノルマ未達ならラン終了（failed）', () => {
    const committed = commit(minimalRun()); // スコア1 < ノルマ
    expect(committed.outcome.cleared).toBe(false);
    expect(committed.state.phase).toBe('failed');
    expect(committed.state.history[0]?.score).toBe('1');
  });

  it('ノルマ達成なら次シフトへ（予算繰越 + 報酬 + 収入 + 次シフト予算、盤面は持ち越し）', () => {
    const balance = withBalance({ shifts: easyShifts(2, 99) });
    const run = minimalRun(1, balance);
    const first = commit(run);
    expect(first.state.phase).toBe('building');
    expect(first.state.shiftIndex).toBe(1);
    expect(first.state.budget).toBe(run.budget + 2 + first.outcome.income + 10);
    expect(first.state.board).toEqual(run.board);
    expect(first.state.rerollCount).toBe(0);
    expect(first.state.trialCount).toBe(0);

    const second = commit(first.state);
    expect(second.state.phase).toBe('cleared');
    expect(commitShift(second.state)).toEqual({ error: 'notBuilding' });
  });

  it('9シフト（3日 × 朝・昼・夜）で、ノルマは段階的に上昇する', () => {
    const quotas = BALANCE.shifts.map((s) => s.quota);
    expect(quotas).toHaveLength(9);
    for (let i = 1; i < quotas.length; i++) expect(quotas[i]).toBeGreaterThan(quotas[i - 1]!);
    expect(BALANCE.shifts.filter((s) => s.kind === 'boss')).toHaveLength(3);
  });

  it('何日目・何シフト目かを求められる', () => {
    const run = createRun(1);
    expect(getDayAndPeriod(run, 0)).toEqual({ day: 0, period: 0 });
    expect(getDayAndPeriod(run, 5)).toEqual({ day: 1, period: 2 });
  });

  it('ノルマ1のシフト表なら、9シフトを最後まで進められる（ボスで戻されたパーツは置き直す）', () => {
    const balance = withBalance({ shifts: easyShifts(9) });
    let run = createRun(7, { balance });
    for (let i = 0; i < 9; i++) {
      run = placeSwitchAndDock(run);
      run = commit(run).state;
    }
    expect(run.phase).toBe('cleared');
    expect(run.history).toHaveLength(9);
  });
});
