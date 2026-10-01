import { createInitialMeta } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { factoryLogUnlocks, titleRocketStage } from '../src/ui/worldProgress';

describe('世界観UIの進行表示', () => {
  it('未プレイではロケットが未完成の先頭段階になる', () => {
    expect(titleRocketStage(null, 9)).toBe(0);
    expect(titleRocketStage(createInitialMeta(), 9)).toBe(0);
  });

  it('最高到達シフトに応じてロケットが組み上がり、クリア後は完成する', () => {
    const meta = createInitialMeta();
    meta.records.runsPlayed = 1;
    meta.records.bestShiftReached = 4;
    expect(titleRocketStage(meta, 9)).toBe(5);

    meta.records.clears = 1;
    expect(titleRocketStage(meta, 9)).toBe(9);
  });

  it('工場の人物記録をプレイ状況に応じて公開する', () => {
    const meta = createInitialMeta();
    expect(factoryLogUnlocks(meta)).toMatchObject({
      factory: true,
      bolt: true,
      nut: false,
      gizmo: false,
      cash8: false,
      millie: false,
      maru: false,
    });

    meta.records.runsPlayed = 2;
    meta.records.bestShiftReached = 2;
    meta.records.clears = 1;
    meta.unlockedParts.push('piggyBank');
    expect(Object.values(factoryLogUnlocks(meta)).every(Boolean)).toBe(true);
  });
});
