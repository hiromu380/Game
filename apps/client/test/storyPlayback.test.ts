import { createRun, type RunState } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { autoPlayScene, memoryScenes, SCENE_IDS, triggerAfterCommit } from '../src/story/playback';

const ALL = SCENE_IDS;
const at = (
  run: RunState,
  shiftIndex: number,
  phase: RunState['phase'] = 'building',
): RunState => ({
  ...run,
  shiftIndex,
  phase,
});

describe('カットシーンのきっかけ', () => {
  const run = createRun(1);

  it('1日の最後のシフトをクリアしたら、その日の幕間（日は 1 始まり）', () => {
    expect(triggerAfterCommit(at(run, 2), at(run, 3))).toEqual({ kind: 'dayCleared', day: 1 });
    expect(triggerAfterCommit(at(run, 5), at(run, 6))).toEqual({ kind: 'dayCleared', day: 2 });
    expect(triggerAfterCommit(at(run, 0), at(run, 1))).toBeNull();
  });

  it('全シフトクリア・ノルマ未達。延長戦では出さない', () => {
    expect(triggerAfterCommit(at(run, 8), at(run, 8, 'cleared'))).toEqual({ kind: 'runCleared' });
    expect(triggerAfterCommit(at(run, 4), at(run, 4, 'failed'))).toEqual({ kind: 'runFailed' });
    const overtime = { ...at(run, 11), overtime: true };
    expect(triggerAfterCommit(overtime, { ...overtime, shiftIndex: 12 })).toBeNull();
  });
});

describe('自動で再生するシーン', () => {
  const ctx = {
    mode: 'normal' as const,
    edition: 'full' as const,
    seen: [] as string[],
    available: ALL,
  };

  it('初回だけ再生し、見たシーンは出さない', () => {
    expect(autoPlayScene({ kind: 'newRun' }, ctx)).toBe('opening');
    expect(autoPlayScene({ kind: 'newRun' }, { ...ctx, seen: ['opening'] })).toBeNull();
    expect(autoPlayScene({ kind: 'dayCleared', day: 1 }, ctx)).toBe('interlude1');
    expect(autoPlayScene({ kind: 'dayCleared', day: 3 }, ctx)).toBeNull(); // 最終日は幕間を省く
    expect(autoPlayScene({ kind: 'runFailed' }, ctx)).toBe('gameOver');
  });

  it('デイリー・練習では出さない', () => {
    expect(autoPlayScene({ kind: 'newRun' }, { ...ctx, mode: 'weekly' })).toBeNull();
    expect(autoPlayScene({ kind: 'runFailed' }, { ...ctx, mode: 'practice' })).toBeNull();
  });

  it('体験版はエンディングの代わりに予告。用意していないシーンは出さない', () => {
    expect(autoPlayScene({ kind: 'runCleared' }, ctx)).toBe('ending');
    expect(autoPlayScene({ kind: 'runCleared' }, { ...ctx, edition: 'demo' })).toBe('demoTeaser');
    expect(autoPlayScene({ kind: 'newRun' }, { ...ctx, available: [] })).toBeNull();
  });

  it('思い出には見たシーンだけを並べ、体験版ではエンディングを出さない', () => {
    expect(memoryScenes(['gameOver', 'opening'], 'full', ALL)).toEqual(['opening', 'gameOver']);
    expect(memoryScenes(['ending', 'demoTeaser'], 'demo', ALL)).toEqual(['demoTeaser']);
  });
});
