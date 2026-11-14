import { describe, expect, it } from 'vitest';
import {
  advanceBasho,
  breakEvenHeads,
  createGame,
  headGain,
  projectLedger,
  sekitoriGain,
  stableCapacity,
} from '../src';
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

  it('弟子が1人増えると口座が増える。黒字まであと何人かは、その人数を足すと黒字になる最小の数', () => {
    const s = createGame({ seed: 3 });
    const per = headGain(s);
    expect(per).toBeGreaterThan(0);
    const n = breakEvenHeads(s)!;
    expect(n).toBeGreaterThan(0);
    expect(projectLedger(s, new Map(), n).stableNet).toBeGreaterThanOrEqual(0);
    expect(projectLedger(s, new Map(), n - 1).stableNet).toBeLessThan(0);
  });

  it('黒字なら 0。定員を超えないと届かないなら null', () => {
    const s = createGame({ seed: 3 });
    const rich = { ...s, player: { ...s.player, koenkai: { ...s.player.koenkai, members: 5000 } } };
    expect(projectLedger(rich).stableNet).toBeGreaterThanOrEqual(0);
    expect(breakEvenHeads(rich)).toBe(0);
    // 部屋をほぼ定員まで埋めて、なお赤字なら届かない
    const cramped = JSON.parse(JSON.stringify(s)) as typeof s;
    const others = cramped.rikishi.filter((r) => r.stableId !== s.player.stableId);
    const room = () =>
      stableCapacity(cramped) -
      cramped.rikishi.filter((r) => r.stableId === s.player.stableId).length;
    for (const r of others) {
      if (room() <= 1) break;
      r.stableId = s.player.stableId;
    }
    cramped.player.koenkai.members = 0;
    const net = projectLedger(cramped).stableNet;
    expect(net).toBeLessThan(0);
    expect(Math.ceil(-net / headGain(cramped))).toBeGreaterThan(room());
    expect(breakEvenHeads(cramped)).toBeNull();
  });
});
