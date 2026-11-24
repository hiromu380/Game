import { describe, expect, it } from 'vitest';
import { advanceBasho, createGame, migrateSave, MONEY_LOG_MAX, type GameState } from '../src';
import { play } from './play';

describe('経営の記録', () => {
  it('場所ごとに精算の後の値を残し、上限で古いものを捨てる', () => {
    const g = play(5, MONEY_LOG_MAX + 3);
    expect(g.moneyLog.length).toBe(MONEY_LOG_MAX);
    const last = g.moneyLog.at(-1)!;
    expect(last.bashoIndex).toBe(g.lastReport!.bashoIndex);
    expect(last.stableMoney).toBe(g.player.stableMoney);
    const a = g.moneyLog.map((e) => e.bashoIndex);
    expect(a).toEqual([...a].sort((x, y) => x - y));
  });

  it('版26のセーブは直近の場所から記録を始める', () => {
    const g = advanceBasho(createGame({ seed: 2 }));
    const old = JSON.parse(JSON.stringify(g)) as Partial<GameState> & { version: number };
    delete old.moneyLog;
    old.version = 26;
    const m = migrateSave(old)!;
    expect(m.version).toBe(28);
    // 版26から変換した記録には、部屋の力の順位（後から足した項目）はない
    const drop = (xs: GameState['moneyLog']) => xs.map(({ place: _place, ...e }) => e);
    expect(drop(m.moneyLog)).toEqual(drop(g.moneyLog));
    expect(g.moneyLog[0]!.place).toBeGreaterThan(0);
  });
});
