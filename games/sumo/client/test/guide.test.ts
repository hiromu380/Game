import { describe, expect, it } from 'vitest';
import { acceptCandidate, advanceBasho, createGame } from '@ichimon/sim';
import { DEFAULT_GUIDE } from '../src/save';
import { doneSteps, GUIDE_UNTIL_BASHO, nudgeOf, showGuide, withStep, withTip } from '../src/guide';

describe('はじめての人向けの案内', () => {
  it('受け入れた・場所を進めたは、ゲームの状態から済みになる', () => {
    let s = createGame({ seed: 2 });
    while (s.pending.candidates.length === 0) s = advanceBasho(s);
    expect(doneSteps(s, DEFAULT_GUIDE).has('accept')).toBe(false);
    s = acceptCandidate(s, s.pending.candidates[0]!.id);
    const d = doneSteps(s, DEFAULT_GUIDE);
    expect(d.has('accept')).toBe(true);
    expect(d.has('basho')).toBe(true);
  });

  it('全部済むか、閉じるか、慣れた頃（12場所）には出さない', () => {
    const s = createGame({ seed: 1 });
    expect(showGuide(s, DEFAULT_GUIDE)).toBe(true);
    expect(showGuide(s, { ...DEFAULT_GUIDE, dismissed: true })).toBe(false);
    expect(showGuide({ ...s, bashoIndex: GUIDE_UNTIL_BASHO }, DEFAULT_GUIDE)).toBe(false);
    const all = ['accept', 'policy', 'basho', 'bout', 'ledger'] as const;
    expect(showGuide(s, { ...DEFAULT_GUIDE, done: [...all] })).toBe(false);
  });

  it('同じ手順・同じタブは二重に足さない', () => {
    const g = withStep(withStep(DEFAULT_GUIDE, 'bout'), 'bout');
    expect(g.done).toEqual(['bout']);
    expect(withTip(withTip(g, 'ledger'), 'ledger').tips).toEqual(['ledger']);
  });
});

describe('次に押すところの印', () => {
  it('手引きの順に、弟子タブ → 本場所へ → 前の結果 → 帳簿 と移り、済んだら出さない', () => {
    const DEFAULT = DEFAULT_GUIDE;
    const g0 = createGame({ seed: 5 });
    let p = DEFAULT;
    expect(nudgeOf(g0, p)).toBe('deshi');
    p = withStep(p, 'policy');
    expect(nudgeOf(g0, p)).toBe('main');
    const g1 = advanceBasho(g0);
    expect(nudgeOf(g1, p)).toBe('report');
    p = withStep(p, 'bout');
    expect(nudgeOf(g1, p)).toBe('ledger');
    p = withStep(withStep(p, 'ledger'), 'accept');
    expect(nudgeOf(g1, p)).toBeNull();
    expect(nudgeOf(g0, { ...DEFAULT, dismissed: true })).toBeNull();
  });
});
