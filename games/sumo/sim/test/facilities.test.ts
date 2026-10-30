import { describe, expect, it } from 'vitest';
import {
  acceptCandidate,
  advanceBasho,
  buildFacility,
  createGame,
  FACILITIES,
  GAME,
  setContract,
  stableCapacity,
} from '../src';
import { settleBasho } from '../src/money/ledger';

describe('設備と契約', () => {
  it('建物は部屋の口座から払い、足りなければ建てられない', () => {
    const s = createGame({ seed: 1 });
    s.player.stableMoney = FACILITIES.dojo.costs[0]!;
    const built = buildFacility(s, 'dojo');
    expect(built.player.facilities.dojo).toBe(1);
    expect(built.player.stableMoney).toBe(0);
    expect(buildFacility(built, 'dojo')).toBe(built); // お金が足りない
  });

  it('寮を増築すると住める人数が増える', () => {
    const s = createGame({ seed: 1 });
    expect(stableCapacity(s)).toBe(GAME.stableCapacity);
    s.player.stableMoney = 1e9;
    expect(stableCapacity(buildFacility(s, 'dorm'))).toBe(GAME.stableCapacity + 10);
  });

  it('部屋がいっぱいだと入門希望者を受け入れられない', () => {
    const s = createGame({ seed: 5 });
    const c = s.pending.candidates[0];
    if (!c) return;
    const mine = s.rikishi.filter((r) => r.stableId === s.player.stableId);
    const extra = GAME.stableCapacity - mine.length;
    for (let i = 0; i < extra; i++) s.rikishi.push({ ...mine[0]!, id: 100000 + i });
    expect(acceptCandidate(s, c.id)).toBe(s);
  });

  it('契約は場所ごとの費用として帳簿に出る（建物は維持費）', () => {
    const l = settleBasho([], 0, [], { dorm: 1, dojo: 2, trainer: 1, scout: 2 });
    const f = l.expenses.find((x) => x.key === 'facilities')!.amount;
    expect(f).toBe(
      FACILITIES.dorm.upkeepPerLevel +
        FACILITIES.dojo.upkeepPerLevel * 2 +
        FACILITIES.trainer.costs[0]! +
        FACILITIES.scout.costs[1]!,
    );
  });

  it('スカウトの網を張ると入門希望者が増える（同じシードで2年分を数えて比べる）', () => {
    const count = (scout: number) => {
      let s = setContract(createGame({ seed: 8 }), 'scout', scout);
      let n = 0;
      for (let i = 0; i < 12; i++) {
        s = advanceBasho(s);
        n += s.pending.candidates.length;
      }
      return n;
    };
    expect(count(2)).toBeGreaterThan(count(0));
  });

  it('建物の契約の上げ下げはできない・範囲外のレベルは無視', () => {
    const s = createGame({ seed: 1 });
    expect(setContract(s, 'dorm', 1)).toBe(s);
    expect(setContract(s, 'trainer', 3)).toBe(s);
  });
});
