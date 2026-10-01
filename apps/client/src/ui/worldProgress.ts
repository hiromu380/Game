/** 世界観UIで使う、セーブ進行から表示状態への純粋な変換。 */
import type { MetaProgress } from '@chain-factory/sim';

export type FactoryLogKey = 'factory' | 'bolt' | 'nut' | 'gizmo' | 'cash8' | 'millie' | 'maru';

/** タイトルに表示するロケット段階。未プレイは0、初クリア後は完成段階。 */
export function titleRocketStage(meta: MetaProgress | null, lastStage: number): number {
  if (!meta || meta.records.runsPlayed === 0) return 0;
  if (meta.records.clears > 0) return lastStage;
  return Math.min(
    Math.max(0, lastStage - 1),
    Math.floor(((meta.records.bestShiftReached + 1) * lastStage) / 9),
  );
}

/** 工場の記録の公開状態。ゲームルールには影響しない。 */
export function factoryLogUnlocks(meta: MetaProgress): Record<FactoryLogKey, boolean> {
  return {
    factory: true,
    bolt: true,
    nut: meta.records.runsPlayed >= 1,
    gizmo: meta.records.bestShiftReached >= 2,
    cash8: meta.unlockedParts.includes('piggyBank'),
    millie: meta.records.clears >= 1,
    maru: meta.records.runsPlayed >= 2,
  };
}
