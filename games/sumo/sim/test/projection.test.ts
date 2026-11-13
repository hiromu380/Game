import { describe, expect, it } from 'vitest';
import { advanceBasho, createGame, projectLedger, sekitoriGain } from '../src';
import { sum } from '../src/money/ledger';

describe('収支の見込み', () => {
  it('状態を変えない。同じ状態なら同じ見込み', () => {
    const s = createGame({ seed: 3 });
    const before = JSON.stringify(s);
    const a = projectLedger(s);
    expect(JSON.stringify(s)).toBe(before);
    expect(projectLedger(s)).toEqual(a);
    expect(a.stableNet).toBe(sum(a.income) - sum(a.expenses));
  });

  it('見込みは、実際に場所を進めたときの部屋の口座の動きに近い（成績で動く分だけずれる）', () => {
    const s = createGame({ seed: 3 });
    const p = projectLedger(s);
    const next = advanceBasho(s);
    const actual = sum(next.lastReport!.income) - sum(next.lastReport!.expenses);
    // 会員の増減・タニマチの関係で動く分は、収入の1割に収まる
    expect(Math.abs(actual - p.stableNet)).toBeLessThan(sum(p.income) * 0.1 + 1);
  });

  it('お金が減っていくなら、尽きるまでの場所の数を出す。増えるなら null', () => {
    const s = createGame({ seed: 3 });
    const p = projectLedger(s);
    if (p.stableNet + p.personalNet < 0) expect(p.runway).not.toBeNull();
    const poor = {
      ...s,
      player: { ...s.player, diet: 'hearty' as const, stableMoney: 0, personalMoney: 0 },
    };
    const q = projectLedger(poor);
    if (q.stableNet + q.personalNet < 0) expect(q.runway).toBe(0);
  });

  it('関取を出すと、部屋の口座は増える（養成奨励金と後援会が、関取の費用と減る養成費を上回る）', () => {
    const s = createGame({ seed: 3 });
    for (const r of s.rikishi.filter((x) => x.stableId === s.player.stableId))
      expect(sekitoriGain(s, r.id)).toBeGreaterThan(100_000);
  });
});
