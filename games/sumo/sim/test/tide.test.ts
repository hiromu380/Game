import { describe, expect, it } from 'vitest';
import {
  costOf,
  createGame,
  doPrep,
  PREP,
  TIDE_IDS,
  tideOf,
  type GameState,
  type TideId,
} from '../src';

function start(seed = 5): GameState {
  const s = createGame({ seed });
  for (const r of s.rikishi.filter((x) => x.stableId === s.player.stableId)) {
    r.injury = 0;
    r.fatigue = 50;
    r.policy = 'oshi';
  }
  return s;
}

/** 1週目が want になる場所の状態（場所の番号だけ変える） */
function withTide(want: TideId | null): GameState {
  const s = start();
  for (let i = 0; i < 500; i++) {
    s.bashoIndex = i;
    if (tideOf(s, 1) === want) return s;
  }
  throw new Error(`${want} が見つからない`);
}

describe('今週の好機と逆風', () => {
  it('場所と週で決まり、同じなら同じ。4週の外にはない。どれも出る', () => {
    const s = start();
    expect(tideOf(s, 0)).toBeNull();
    expect(tideOf(s, PREP.weeks + 1)).toBeNull();
    const seen = new Set<TideId | null>();
    let any = 0;
    for (let i = 0; i < 300; i++) {
      for (let w = 1; w <= PREP.weeks; w++) {
        const x = tideOf({ seed: s.seed, bashoIndex: i }, w);
        expect(tideOf({ seed: s.seed, bashoIndex: i }, w)).toBe(x);
        seen.add(x);
        if (x) any++;
      }
    }
    for (const id of TIDE_IDS) expect(seen.has(id)).toBe(true);
    // 何もない週もある
    expect(any).toBeGreaterThan(300);
    expect(any).toBeLessThan(900);
  });

  it('連合稽古の週は出稽古が無料。記録に残る', () => {
    const s = withTide('rengo');
    expect(costOf(s, 'degeiko')).toBe(0);
    expect(costOf(withTide(null), 'degeiko')).toBe(PREP.degeiko.cost);
    const next = doPrep(s, { kind: 'degeiko' });
    expect(next.player.stableMoney).toBe(s.player.stableMoney);
    expect(next.player.personalMoney).toBe(s.player.personalMoney);
    expect(next.prep.log[0]!.tide).toBe('rengo');
  });

  it('雨の週は個別指導の伸びが落ちる。休ませるのは整体師の週によく効く', () => {
    const gain = (s: GameState) => {
      const id = s.rikishi.find((r) => r.stableId === s.player.stableId)!.id;
      const before = s.rikishi.find((r) => r.id === id)!.abilities.oshi;
      const after = doPrep(s, { kind: 'coach', id }).rikishi.find((r) => r.id === id)!;
      return after.abilities.oshi - before;
    };
    expect(gain(withTide('rain'))).toBeLessThan(gain(withTide(null)));
    const rested = (s: GameState) =>
      doPrep(s, { kind: 'rest' })
        .rikishi.filter((r) => r.stableId === s.player.stableId)
        .reduce((n, r) => n + r.fatigue, 0);
    expect(rested(withTide('seitai'))).toBeLessThan(rested(withTide(null)));
  });
});
