import { DEFAULT_RULES, simulate, type Board } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { countActivations, summarizeBreaks } from '../src/playback/breaks';

describe('途切れた理由の集計', () => {
  it('空マス・盤面外・使い切りを場所ごとにまとめる（盤面外は端のマスに寄せる）', () => {
    // 分岐器(1,0)は右向き: 上は盤面外、下は空マス
    const board: Board = {
      width: 3,
      height: 2,
      cells: [{ id: 'switch', dir: 1 }, { id: 'splitter', dir: 1 }, null, null, null, null],
    };
    const result = simulate({ board, seed: 1, rules: DEFAULT_RULES });
    const summary = summarizeBreaks(result.events, board);
    expect(summary.counts).toEqual({ outOfBoard: 1, emptyCell: 1 });
    expect(summary.markers).toContainEqual({ x: 1, y: 0, reason: 'outOfBoard', count: 1 });
    expect(summary.markers).toContainEqual({ x: 1, y: 1, reason: 'emptyCell', count: 1 });
    expect(summary.haltReason).toBeNull();
  });

  it('tick 上限での打ち切りを記録する', () => {
    const board: Board = {
      width: 2,
      height: 1,
      cells: [
        { id: 'switch', dir: 1 },
        { id: 'reflector', dir: 0 },
      ],
    };
    const rules = {
      ...DEFAULT_RULES,
      tickLimit: 1,
    };
    const summary = summarizeBreaks(simulate({ board, seed: 1, rules }).events, board);
    expect(summary.haltReason).toBe('tickLimit');
    expect(summary.haltedSignals).toBe(1);
  });

  it('マスごとの発動回数を数える', () => {
    const board: Board = {
      width: 3,
      height: 1,
      cells: [
        { id: 'switch', dir: 1 },
        { id: 'gear', dir: 1 },
        { id: 'dock', dir: 1 },
      ],
    };
    const counts = countActivations(simulate({ board, seed: 1, rules: DEFAULT_RULES }).events);
    expect(counts.get('1,0')).toEqual({ partId: 'gear', count: 1 });
    expect(counts.get('2,0')).toEqual({ partId: 'dock', count: 1 });
  });
});
