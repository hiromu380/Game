import { createRun, type RunState, type ShiftRecord } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { getNearMiss } from '../src/state/nearMiss';

function failed(record: Partial<ShiftRecord>, budget = 0): RunState {
  return {
    ...createRun(1),
    phase: 'failed',
    budget,
    history: [
      {
        shiftIndex: 0,
        score: '0',
        quota: 100,
        cleared: false,
        chainCount: 0,
        income: 0,
        boss: null,
        ...record,
      },
    ],
  };
}

describe('惜しかった度合いとヒント', () => {
  it('不足分と達成率（切り捨て）を出す', () => {
    expect(getNearMiss(failed({ score: '73', quota: 100 }))).toMatchObject({
      gap: 27n,
      percent: 73,
      hint: 'close',
    });
  });

  it('ヒントの優先度: 出荷ゼロ → 予算の使い残し → 夜の特殊ルール → 少し足りない／倍率不足', () => {
    expect(getNearMiss(failed({ score: '0' }, 20))?.hint).toBe('noShip');
    expect(getNearMiss(failed({ score: '10' }, 5))?.hint).toBe('unspent');
    expect(getNearMiss(failed({ score: '10', boss: 'lowOil' }, 4))?.hint).toBe('boss');
    expect(getNearMiss(failed({ score: '50' }))?.hint).toBe('close');
    expect(getNearMiss(failed({ score: '10' }))?.hint).toBe('multiply');
    // 出荷口が1つだけの盤面: 同時出荷を勧める
    const oneDock = failed({ score: '10' });
    const cells = oneDock.board.cells.map((c, i) =>
      i === 0 ? { id: 'dock' as const, dir: 1 as const } : c,
    );
    expect(getNearMiss({ ...oneDock, board: { ...oneDock.board, cells } })?.hint).toBe('sync');
  });

  it('巨大なノルマでも数字のまま計算する。失敗していないランは null', () => {
    const huge = getNearMiss(failed({ score: '99999999999999999998', quota: 1e20 }));
    expect(huge?.percent).toBe(99);
    expect(getNearMiss(createRun(1))).toBeNull();
  });
});
