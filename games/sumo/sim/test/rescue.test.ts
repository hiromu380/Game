import { describe, expect, it } from 'vitest';
import { advanceBasho, createGame, migrateSave, RESCUE, type GameState } from '../src';

const broke = (g: GameState): GameState => {
  const s = JSON.parse(JSON.stringify(g)) as GameState;
  s.player.stableMoney = 0;
  s.player.personalMoney = -1;
  return s;
};

describe('一門の支援', () => {
  it('お金が尽きたら1代に1度だけ借りてつなぎ、名声が下がる', () => {
    const g = broke(createGame({ seed: 9 }));
    const a = advanceBasho(g);
    expect(a.gameOver).toBeNull();
    expect(a.lastReport!.rescue).toBe(RESCUE.loan);
    expect(a.player.debt).toBe(RESCUE.loan - (a.lastReport!.repaid ?? 0));
    expect(a.player.rescuedGen).toBe(1);
    expect(a.journal.some((e) => e.kind === 'rescue' && e.event === 'loan')).toBe(true);
    // 2度目は部屋をたたむ
    const b = advanceBasho(broke(a));
    expect(b.gameOver).toBe('bankrupt');
  });

  it('毎場所、口座にある分まで返し、返し終えたら日誌に残す', () => {
    const g = JSON.parse(JSON.stringify(createGame({ seed: 9 }))) as GameState;
    g.player.debt = RESCUE.repayPerBasho + 5;
    g.player.stableMoney = 100_000_000;
    const a = advanceBasho(g);
    expect(a.lastReport!.repaid).toBe(RESCUE.repayPerBasho);
    expect(a.player.debt).toBe(5);
    const b = advanceBasho(a);
    expect(b.player.debt).toBe(0);
    expect(b.journal.some((e) => e.kind === 'rescue' && e.event === 'repaid')).toBe(true);
  });

  it('版27のセーブは借りていない状態で読む', () => {
    const old = JSON.parse(JSON.stringify(createGame({ seed: 1 }))) as GameState & {
      version: number;
    };
    delete (old.player as Partial<GameState['player']>).debt;
    delete (old.player as Partial<GameState['player']>).rescuedGen;
    old.version = 27;
    const m = migrateSave(old)!;
    expect(m.version).toBe(29);
    expect(m.player.debt).toBe(0);
    expect(m.player.rescuedGen).toBeNull();
  });
});
