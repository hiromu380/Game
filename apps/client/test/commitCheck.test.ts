/**
 * 本番の前の確認（state/commitCheck.ts）: このまま押すと失敗しそうな理由
 */
import { createRun, getCurrentShift, setPart, type RunState } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { commitWarnings } from '../src/state/commitCheck';

const base = createRun(5);
const withParts = (run: RunState, ids: ('switch' | 'dock' | 'gear')[]): RunState => {
  let board = run.board;
  ids.forEach((id, x) => (board = setPart(board, x, 0, { id, dir: 1 })));
  return { ...run, board };
};

describe('本番の前の確認', () => {
  it('スイッチ・出荷口がなければ、それを伝える（試運転の有無より先に）', () => {
    expect(commitWarnings(base, null).map((w) => w.kind)).toEqual(['noSwitch', 'noDock']);
    expect(commitWarnings(withParts(base, ['switch']), null).map((w) => w.kind)).toEqual([
      'noDock',
    ]);
  });

  it('今の並びで試運転していなければ伝える（盤面を変えたら、前の試運転は数えない）', () => {
    const run = withParts(base, ['switch', 'gear', 'dock']);
    expect(commitWarnings(run, null).map((w) => w.kind)).toEqual(['untested']);
    const trial = { board: run.board, shiftIndex: run.shiftIndex, score: '999' };
    expect(commitWarnings(run, trial)).toEqual([]);
    const moved = { ...run, board: setPart(run.board, 4, 4, { id: 'gear', dir: 0 }) };
    expect(commitWarnings(moved, trial).map((w) => w.kind)).toEqual(['untested']);
    // 別のシフトの試運転も数えない（ノルマ・床が変わるため）
    expect(commitWarnings(run, { ...trial, shiftIndex: run.shiftIndex + 1 })[0]?.kind).toBe(
      'untested',
    );
  });

  it('直前の試運転がノルマ未満なら、出荷量とノルマを伝える', () => {
    const run = withParts(base, ['switch', 'gear', 'dock']);
    const quota = getCurrentShift(run).quota;
    const short = { board: run.board, shiftIndex: run.shiftIndex, score: String(quota - 1) };
    expect(commitWarnings(run, short)).toEqual([
      { kind: 'short', score: String(quota - 1), quota },
    ]);
    const exact = { ...short, score: String(quota) };
    expect(commitWarnings(run, exact)).toEqual([]);
  });
});
