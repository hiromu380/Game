import { describe, expect, it } from 'vitest';
import {
  advanceBasho,
  TACTIC,
  TACTICS,
  tacticEdge,
  type BoutResult,
  type GameState,
  type Rikishi,
  type Tactic,
} from '../src';
import { autoStep, play } from './play';

/** 自分の弟子の大一番（最後の番を同じ星で迎えた）: 弟子 → その一番 */
function bigBouts(next: GameState): Map<number, BoutResult> {
  const out = new Map<number, BoutResult>();
  for (const m of next.lastReport?.mine ?? []) {
    const bouts = m.bouts.filter((b) => !b.fusen);
    const last = bouts[bouts.length - 1];
    if (!last) continue;
    const w = bouts.slice(0, -1).filter((b) => b.winnerId === m.id).length;
    if ((w === 3 || w === 7) && bouts.length === w * 2 + 1) out.set(m.id, last);
  }
  return out;
}

/** 大一番のある場所の前の状態を探す */
function withBigBout(seed: number): {
  g: GameState;
  next: GameState;
  id: number;
  bout: BoutResult;
} {
  let g = play(seed, 0);
  for (let i = 0; i < 30; i++) {
    const next = advanceBasho(g);
    const [hit] = bigBouts(next);
    if (hit) return { g, next, id: hit[0], bout: hit[1] };
    g = autoStep(g);
  }
  throw new Error('大一番が見つからない');
}

const rikishi = (abilities: Rikishi['abilities']) => ({ abilities }) as Rikishi;
const OSHI = rikishi({ oshi: 60, yotsu: 40, waza: 40 });
const YOTSU = rikishi({ oshi: 40, yotsu: 60, waza: 40 });
const WAZA = rikishi({ oshi: 40, yotsu: 40, waza: 60 });

describe('大一番の作戦', () => {
  it('作戦は効く相手の型で足し、自分の型に合わなければ減点。変化は読まれると大きく不利', () => {
    expect(tacticEdge('atari', OSHI, WAZA)).toBe(TACTIC.counterEdge);
    expect(tacticEdge('atari', OSHI, YOTSU)).toBe(0);
    expect(tacticEdge('sashi', OSHI, OSHI)).toBe(TACTIC.counterEdge - TACTIC.offStyle);
    expect(tacticEdge('henka', WAZA, YOTSU)).toBe(TACTIC.henkaEdge);
    expect(tacticEdge('henka', OSHI, YOTSU)).toBe(TACTIC.henkaEdge - TACTIC.offStyle);
    expect(tacticEdge('henka', WAZA, OSHI)).toBe(-TACTIC.henkaMiss);
    // どの型の相手にも、効く作戦が1つある
    for (const opp of [OSHI, YOTSU, WAZA])
      expect(TACTICS.filter((x) => tacticEdge(x, WAZA, opp) > 0)).toHaveLength(1);
  });

  it('作戦はその一番だけに効く: それまでの取組と、大一番の相手は変わらない。記録に残る', () => {
    const { g, next, id, bout } = withBigBout(2);
    const out = advanceBasho(g, { tactic: { [id]: 'sashi' } });
    const before = (s: GameState) =>
      s.lastReport!.mine.find((m) => m.id === id)!.bouts.filter((b) => b.day < bout.day);
    expect(before(out)).toEqual(before(next));
    const big = bigBouts(out).get(id)!;
    expect([big.eastId, big.westId].sort()).toEqual([bout.eastId, bout.westId].sort());
    expect(big.tactic).toBe('sashi');
    expect(big.tacticBy).toBe(id);
    // 同じ入力なら同じ結果
    expect(advanceBasho(g, { tactic: { [id]: 'sashi' } })).toEqual(out);
  });

  it('効く作戦を授けると、大一番に勝ちやすい', () => {
    let plain = 0;
    let told = 0;
    let n = 0;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      let g = play(seed, 0);
      for (let i = 0; i < 12; i++) {
        const next = advanceBasho(g);
        const tactic: Record<number, Tactic> = {};
        for (const [id, b] of bigBouts(next)) {
          const own = g.rikishi.find((r) => r.id === id)!;
          const opp = g.rikishi.find((r) => r.id === (b.eastId === id ? b.westId : b.eastId))!;
          const best = TACTICS.filter((x) => x !== 'henka').find(
            (x) => tacticEdge(x, own, opp) > 0,
          );
          if (best) tactic[id] = best;
        }
        if (Object.keys(tactic).length > 0) {
          const out = advanceBasho(g, { tactic });
          for (const id of Object.keys(tactic).map(Number)) {
            n++;
            if (bigBouts(next).get(id)!.winnerId === id) plain++;
            if (bigBouts(out).get(id)!.winnerId === id) told++;
          }
        }
        g = autoStep(g);
      }
    }
    expect(n).toBeGreaterThan(20);
    expect(told).toBeGreaterThan(plain);
  }, 60_000);

  it('変化で勝つと、決まり手ははたき込み。名声が下がり、タニマチが渋い顔をする', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { g, id } = withBigBout(seed);
      // 名声は 0 より下がらないので、名声のある部屋で見る
      g.player.prestige = 10;
      const out = advanceBasho(g, { tactic: { [id]: 'henka' } });
      const big = bigBouts(out).get(id)!;
      if (big.winnerId !== id) continue;
      expect(big.kimarite).toBe(TACTIC.henkaKimarite);
      expect(out.lastReport!.henka).toEqual([id]);
      const plain = advanceBasho(g);
      if (bigBouts(plain).get(id)!.winnerId !== id) continue;
      // 同じ勝ちでも、変化の方が名声が低く、タニマチの関係も低い
      expect(out.player.prestige).toBeLessThan(plain.player.prestige);
      const favor = (x: GameState) => x.player.koenkai.patrons.reduce((n, p) => n + p.favor, 0);
      if (plain.player.koenkai.patrons.length > 0) expect(favor(out)).toBeLessThan(favor(plain));
      return;
    }
    throw new Error('変化で勝った例が見つからない');
  }, 60_000);

  it('よその部屋の力士には作戦を授けられない', () => {
    const { g, next } = withBigBout(2);
    const other = g.rikishi.find((r) => r.stableId !== g.player.stableId)!;
    expect(advanceBasho(g, { tactic: { [other.id]: 'henka' } })).toEqual(next);
  });
});
