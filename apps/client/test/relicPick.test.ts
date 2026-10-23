/**
 * レリック（画面側）: 選ぶ操作が操作ログに残り、手応え（効果音・表示）が出る。撮影モードで選択を出せる
 */
import { createInitialMeta, createRun, isRelicPending } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { feedbackMessage } from '../src/state/feedbackMessage';
import { createGameState, gameReducer } from '../src/state/gameReducer';

describe('レリックの操作', () => {
  it('撮影モードで選択を出し、選ぶと持ち物に入って操作ログに残る（専用の手応え）', () => {
    let game = createGameState(createRun(3), createInitialMeta());
    game = gameReducer(game, { type: 'captureGiveRelic' });
    expect(isRelicPending(game.run)).toBe(true);
    const first = game.run.relicChoice!.choices[0]!;
    game = gameReducer(game, { type: 'pickRelic', index: 0 });
    expect(isRelicPending(game.run)).toBe(false);
    expect(game.run.relics).toEqual([first]);
    expect(game.pendingOps.at(-1)).toEqual({ op: 'pickRelic', index: 0 });
    expect(game.feedback?.kind).toBe('relicPick');
    expect(feedbackMessage('relicPick', 0)).toEqual({ kind: 'relicPick', amount: 0 });
  });

  it('もう一度出すと、持っているものは候補に出ない', () => {
    let game = createGameState(createRun(3), createInitialMeta());
    game = gameReducer(game, { type: 'captureGiveRelic' });
    game = gameReducer(game, { type: 'pickRelic', index: 0 });
    game = gameReducer(game, { type: 'captureGiveRelic' });
    expect(game.run.relicChoice!.choices).not.toContain(game.run.relics![0]);
  });
});
