/**
 * ラン進行（シフト・予算・ショップ・ノルマ）のテスト
 */
import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  buyOffer,
  commitShift,
  createRun,
  generateShop,
  getRefund,
  placePart,
  previewShift,
  removePart,
  rotatePart,
  scoreToString,
  type RunActionResult,
  type RunState,
} from '../src';

/** 成功を前提に state を取り出す */
function unwrap(result: RunActionResult): RunState {
  if (!result.ok) throw new Error(`操作に失敗: ${result.error}`);
  return result.state;
}

describe('ランの開始', () => {
  it('初期予算・初期キット・ショップが用意される', () => {
    const run = createRun(1);
    expect(run.shiftIndex).toBe(0);
    expect(run.phase).toBe('building');
    expect(run.budget).toBe(BALANCE.run.shifts[0].budget);
    expect(run.inventory).toEqual(BALANCE.run.starterKit);
    expect(run.shop).toHaveLength(BALANCE.shop.offersPerShift);
    expect(run.board.width).toBe(BALANCE.board.width);
  });

  it('同じシードなら同じショップ、違うシードなら（多くの場合）違うショップ', () => {
    expect(createRun(5).shop).toEqual(createRun(5).shop);
    const shops = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(createRun(i).shop)));
    expect(shops.size).toBeGreaterThan(1);
  });

  it('ショップにはスイッチ（出現重み0）が並ばず、価格は balance.ts の固定値', () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const offer of generateShop(seed)) {
        expect(offer.partId).not.toBe('switch');
        expect(offer.price).toBe(BALANCE.parts[offer.partId].price);
      }
    }
  });
});

describe('購入・配置・回転・撤去', () => {
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

  it('配置・回転・撤去（半額返金、スイッチは手持ちに戻る）', () => {
    let run = createRun(1);
    run = unwrap(placePart(run, 'switch', 0, 0, 1));
    run = unwrap(placePart(run, 'dock', 1, 0, 1));
    expect(run.inventory).toEqual({});
    expect(placePart(run, 'dock', 2, 0, 1)).toEqual({ ok: false, error: 'notInInventory' });

    run = unwrap(rotatePart(run, 1, 0));
    expect(run.board.cells[1]).toEqual({ id: 'dock', dir: 2 });

    const budget = run.budget;
    run = unwrap(removePart(run, 1, 0));
    expect(run.budget).toBe(budget + getRefund('dock'));
    expect(getRefund('dock')).toBe(Math.floor(BALANCE.parts.dock.price / 2));

    run = unwrap(removePart(run, 0, 0));
    expect(run.inventory.switch).toBe(1);
  });
});

describe('シフトの確定とノルマ', () => {
  /** スイッチと出荷口を置いた最小構成のラン */
  function minimalRun(): RunState {
    let run = createRun(1);
    run = unwrap(placePart(run, 'switch', 0, 0, 1));
    run = unwrap(placePart(run, 'dock', 1, 0, 1));
    return run;
  }

  it('試運転は state を変えず、確定と同じ結果になる', () => {
    const run = minimalRun();
    const preview = previewShift(run);
    const committed = commitShift(run);
    if ('error' in committed) throw new Error(committed.error);
    expect(committed.result).toEqual(preview);
  });

  it('ノルマ未達ならラン終了（failed）', () => {
    const committed = commitShift(minimalRun()); // スコア1 < ノルマ
    if ('error' in committed) throw new Error(committed.error);
    expect(committed.outcome.cleared).toBe(false);
    expect(committed.state.phase).toBe('failed');
    expect(committed.state.history[0]?.score).toBe('1');
  });

  it('ノルマ達成なら次シフトへ（予算繰越 + 報酬 + 次シフト予算、盤面は持ち越し）', () => {
    // ノルマを1にしたバランスで達成させる
    const balance = {
      ...BALANCE,
      run: {
        ...BALANCE.run,
        shifts: [
          { quota: 1, budget: 10, clearReward: 3 },
          { quota: 1, budget: 7, clearReward: 0 },
        ],
      },
    } as unknown as typeof BALANCE;
    const run = minimalRun();
    const first = commitShift(run, balance);
    if ('error' in first) throw new Error(first.error);
    expect(first.state.phase).toBe('building');
    expect(first.state.shiftIndex).toBe(1);
    expect(first.state.budget).toBe(run.budget + 3 + 7);
    expect(first.state.board).toEqual(run.board);
    expect(first.state.shop).not.toEqual(run.shop);

    const second = commitShift(first.state, balance);
    if ('error' in second) throw new Error(second.error);
    expect(second.state.phase).toBe('cleared');
    expect(commitShift(second.state, balance)).toEqual({ error: 'notBuilding' });
  });

  it('ノルマは段階的に上昇する', () => {
    const quotas = BALANCE.run.shifts.map((s) => s.quota);
    expect(quotas).toHaveLength(3);
    for (let i = 1; i < quotas.length; i++) expect(quotas[i]).toBeGreaterThan(quotas[i - 1]!);
  });

  it('同じシード・同じ配置なら同じスコア', () => {
    const a = previewShift(minimalRun());
    const b = previewShift(minimalRun());
    expect(scoreToString(a.score)).toBe(scoreToString(b.score));
  });
});
