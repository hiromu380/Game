import { describe, expect, it } from 'vitest';
import { advanceBasho, createGame, previewBasho, type GameState } from '../src';

/** 自分の弟子（番付に載っている）の1人を、全治2場所のけがで休ませた状態 */
function withAbsent(seed: number): { s: GameState; id: number } {
  const s = createGame({ seed });
  const r = s.rikishi.find((x) => x.stableId === s.player.stableId && s.banzuke.includes(x.id))!;
  r.injury = 2;
  return { s, id: r.id };
}

describe('中日（8日目）の判断', () => {
  it('中日の様子は、そのまま進めた場所の前半と同じ', () => {
    const s = createGame({ seed: 8 });
    const mid = previewBasho(s)!;
    const next = advanceBasho(s);
    expect(mid.day).toBe(8);
    for (const m of mid.mine) {
      const bouts = next
        .lastReport!.mine.find((x) => x.id === m.id)!
        .bouts.filter((b) => b.day <= 8);
      expect(bouts.filter((b) => b.winnerId === m.id).length).toBe(m.wins);
      expect(bouts.filter((b) => b.winnerId !== m.id).length).toBe(m.losses);
    }
    expect(mid.leaders.ids.length).toBeGreaterThan(0);
  });

  it('休場している弟子は「休んでいる」と出て、後半から途中出場できる。けがは治らない', () => {
    const { s, id } = withAbsent(3);
    expect(previewBasho(s)!.mine.find((m) => m.id === id)!.out).toBe(true);
    const stay = advanceBasho(s);
    const go = advanceBasho(s, { reenter: [id] });
    const boutsOf = (g: GameState) => g.lastReport!.mine.find((m) => m.id === id)!.bouts;
    expect(boutsOf(stay)).toHaveLength(0);
    expect(boutsOf(go).length).toBeGreaterThan(0);
    expect(boutsOf(go).every((b) => b.day > 8)).toBe(true);
    expect(go.lastReport!.reentered).toEqual([id]);
    const rec = go.lastReport!.mine.find((m) => m.id === id)!.record;
    expect(rec.absences).toBeGreaterThan(0);
    // 休めば1場所ぶん治るが、出たら治らない（悪化することもある）
    expect(stay.rikishi.find((r) => r.id === id)!.injury).toBe(1);
    const after = go.rikishi.find((r) => r.id === id);
    if (after) expect(after.injury).toBeGreaterThanOrEqual(2);
  });

  it('前半の取組は、後半の判断で変わらない。自分の弟子でない力士は出せない', () => {
    const { s, id } = withAbsent(5);
    const stay = advanceBasho(s);
    const go = advanceBasho(s, { reenter: [id] });
    const firstHalf = (g: GameState) =>
      g.lastReport!.mine.flatMap((m) => m.bouts.filter((b) => b.day <= 8));
    expect(firstHalf(go)).toEqual(firstHalf(stay));
    const other = s.rikishi.find((r) => r.stableId !== s.player.stableId)!;
    expect(advanceBasho(s, { reenter: [other.id] })).toEqual(stay);
  });
});
