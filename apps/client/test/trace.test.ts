import { DEFAULT_RULES, simulate, type Board } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { summarizeTrace } from '../src/playback/trace';

describe('信号が通った道すじの集計', () => {
  it('通った区間を向きつきでまとめ、盤面の外へ出た区間も含める', () => {
    // スイッチ(0,0)→ 分岐器(1,0)は右向き: 上（盤面外）と下（空マス）へ分かれる
    const board: Board = {
      width: 3,
      height: 2,
      cells: [{ id: 'switch', dir: 1 }, { id: 'splitter', dir: 1 }, null, null, null, null],
    };
    const result = simulate({ board, seed: 1, rules: DEFAULT_RULES });
    const segments = summarizeTrace(result.events);
    expect(segments).toEqual([
      { fromX: 0, fromY: 0, toX: 1, toY: 0, count: 1 },
      { fromX: 1, fromY: 0, toX: 1, toY: -1, count: 1 },
      { fromX: 1, fromY: 0, toX: 1, toY: 1, count: 1 },
    ]);
  });

  it('同じ区間を同じ向きに通った信号は本数を数える（逆向きは別の区間）', () => {
    // コピー機は同じ向きへ2連射する。反射板は来た方向へ跳ね返す
    const board: Board = {
      width: 3,
      height: 1,
      cells: [
        { id: 'switch', dir: 1 },
        { id: 'copier', dir: 1 },
        { id: 'reflector', dir: 0 },
      ],
    };
    const result = simulate({ board, seed: 1, rules: DEFAULT_RULES });
    const segments = summarizeTrace(result.events);
    const find = (fromX: number, toX: number) =>
      segments.find((s) => s.fromX === fromX && s.toX === toX)?.count;
    expect(find(0, 1)).toBe(1);
    expect(find(1, 2)).toBe(2);
    expect(find(2, 1)).toBeGreaterThanOrEqual(1);
  });

  it('同じ events からは同じ結果になり、信号がなければ空', () => {
    const board: Board = { width: 2, height: 1, cells: [{ id: 'switch', dir: 1 }, null] };
    const { events } = simulate({ board, seed: 1, rules: DEFAULT_RULES });
    expect(summarizeTrace(events)).toEqual(summarizeTrace(events));
    expect(summarizeTrace([])).toEqual([]);
  });
});
