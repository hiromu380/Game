import { describe, expect, it } from 'vitest';
import {
  buildFacility,
  canAfford,
  createGame,
  doPrep,
  fromSavings,
  nextBuildCost,
  pay,
  PREP,
} from '../src';

describe('親方の行動の支払い（口座から、足りない分は貯金から）', () => {
  it('口座で足りれば口座から。足りなければ残りを貯金から。両方で足りなければ払わない', () => {
    const s = createGame({ seed: 1 });
    s.player.stableMoney = 300_000;
    s.player.personalMoney = 1_000_000;
    expect(fromSavings(s, 200_000)).toBe(0);
    expect(fromSavings(s, 500_000)).toBe(200_000);
    expect(pay(s, 500_000)).toBe(true);
    expect(s.player.stableMoney).toBe(0);
    expect(s.player.personalMoney).toBe(800_000);
    expect(canAfford(s, 900_000)).toBe(false);
    expect(pay(s, 900_000)).toBe(false);
    expect(s.player.personalMoney).toBe(800_000);
  });

  it('口座が空でも、胸を借りる・出稽古・建物は貯金で払える', () => {
    const s = createGame({ seed: 1 });
    const r = s.rikishi.find((x) => x.stableId === s.player.stableId && x.injury === 0)!;
    r.policy = 'oshi';
    s.player.stableMoney = 0;
    const mune = doPrep(s, { kind: 'mune', id: r.id });
    expect(mune.prep.week).toBe(1);
    expect(mune.player.personalMoney).toBe(s.player.personalMoney - PREP.mune.cost);
    expect(mune.player.stableMoney).toBe(0);
    const cost = nextBuildCost(s.player.facilities, 'dojo')!;
    s.player.personalMoney = cost + 1_000_000;
    const built = buildFacility(s, 'dojo');
    expect(built.player.facilities.dojo).toBe(s.player.facilities.dojo + 1);
    expect(built.player.personalMoney).toBe(s.player.personalMoney - cost);
  });
});
