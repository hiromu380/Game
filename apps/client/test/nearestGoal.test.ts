/**
 * 結果画面の「次の目標」（ui/MetaPanel.tsx の nearestGoal）: いちばん近い解放の目標を1つ選ぶ
 */
import { BALANCE, createInitialMeta, type MetaProgress } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { nearestGoal } from '../src/ui/MetaPanel';

describe('次の目標', () => {
  it('まだ解放していない目標のうち、達成度がいちばん高いものを選ぶ', () => {
    const meta = createInitialMeta();
    const played: MetaProgress = { ...meta, records: { ...meta.records, runsPlayed: 1 } };
    const goal = nearestGoal(played);
    // 1回遊んだ時点では「2回遊ぶ」で解放される仕分け機が 50% でいちばん近い
    expect(goal).toMatchObject({ kind: 'part', partId: 'sorter', progress: 0.5 });
  });

  it('解放済みは選ばず、すべて解放済みなら null', () => {
    const meta = createInitialMeta();
    const played: MetaProgress = {
      ...meta,
      unlockedParts: [...meta.unlockedParts, 'sorter'],
      records: { ...meta.records, runsPlayed: 1 },
    };
    expect(nearestGoal(played)).not.toMatchObject({ partId: 'sorter' });
    const all: MetaProgress = {
      ...meta,
      unlockedParts: [...meta.unlockedParts, ...BALANCE.meta.partUnlocks.map((u) => u.partId)],
      boardLevel: BALANCE.meta.boardExpansions.length,
    };
    expect(nearestGoal(all)).toBeNull();
  });
});
