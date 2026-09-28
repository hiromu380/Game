/**
 * メタ進行（実績の記録・新パーツの解放・工場拡張）のテスト
 */
import { describe, expect, it } from 'vitest';
import {
  applyRunToMeta,
  BALANCE,
  createInitialMeta,
  createRun,
  isConditionMet,
  metaToModifiers,
  type RunState,
} from '../src';

/** 履歴を持たせた終了済みのランを作る */
function finishedRun(
  phase: 'cleared' | 'failed',
  history: { score: string; chainCount: number }[],
): RunState {
  return {
    ...createRun(1),
    phase,
    history: history.map((h, i) => ({
      shiftIndex: i,
      score: h.score,
      quota: 1,
      cleared: true,
      chainCount: h.chainCount,
      income: 0,
      boss: null,
    })),
  };
}

describe('メタ進行', () => {
  it('最初は初期解放パーツだけがショップに並ぶ', () => {
    const meta = createInitialMeta();
    const run = createRun(1, { meta: metaToModifiers(meta) });
    const pool = run.config.economy.shopPool.map((p) => p.partId);
    expect(new Set(pool)).toEqual(new Set(BALANCE.meta.initialUnlocked));
    expect(run.board.width).toBe(BALANCE.board.width);
  });

  it('進行中のランでは何も変わらない', () => {
    const meta = createInitialMeta();
    expect(applyRunToMeta(meta, createRun(1))).toEqual({ meta, unlocks: [] });
  });

  it('ランの実績（累計出荷・最大連鎖・到達シフト・回数）を記録する', () => {
    const { meta } = applyRunToMeta(
      createInitialMeta(),
      finishedRun('failed', [
        { score: '10', chainCount: 3 },
        { score: '50', chainCount: 8 },
      ]),
    );
    expect(meta.records).toEqual({
      totalShipped: '60',
      bestShiftScore: '50',
      bestChain: 8,
      bestShiftReached: 1,
      runsPlayed: 1,
      clears: 0,
    });
  });

  it('条件を満たしたパーツが解放される（1度だけ）', () => {
    const chainGoal = BALANCE.meta.partUnlocks.find((u) => u.condition.kind === 'bestChain')!;
    const run = finishedRun('failed', [{ score: '1', chainCount: chainGoal.condition.value }]);
    const first = applyRunToMeta(createInitialMeta(), run);
    expect(first.unlocks).toContainEqual({ kind: 'part', partId: chainGoal.partId });
    expect(first.meta.unlockedParts).toContain(chainGoal.partId);

    const second = applyRunToMeta(first.meta, run);
    expect(
      second.unlocks.filter((u) => u.kind === 'part' && u.partId === chainGoal.partId),
    ).toEqual([]);
  });

  it('全シフトクリアで工場が拡張され、次のランの盤面が広くなる', () => {
    const { meta, unlocks } = applyRunToMeta(
      createInitialMeta(),
      finishedRun('cleared', [{ score: '1', chainCount: 1 }]),
    );
    expect(unlocks).toContainEqual({ kind: 'board', level: 1 });
    const run = createRun(1, { meta: metaToModifiers(meta) });
    expect(run.board.width).toBe(BALANCE.board.width + 1);
    expect(run.board.height).toBe(BALANCE.board.height + 1);
  });

  it('解放条件の判定', () => {
    const records = createInitialMeta().records;
    expect(isConditionMet(records, { kind: 'runsPlayed', value: 0 })).toBe(true);
    expect(isConditionMet(records, { kind: 'reachShift', value: 1 })).toBe(true);
    expect(isConditionMet(records, { kind: 'reachShift', value: 2 })).toBe(false);
    expect(
      isConditionMet(
        { ...records, totalShipped: '99999999999999999999' },
        { kind: 'totalShipped', value: 10 },
      ),
    ).toBe(true);
  });
});
