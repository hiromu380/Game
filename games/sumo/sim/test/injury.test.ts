import { describe, expect, it } from 'vitest';
import { advanceBasho, createGame, setPlayHurt, type GameState } from '../src';

/** 自分の弟子の1人をけがさせた状態 */
function hurt(seed: number): { s: GameState; id: number } {
  const s = createGame({ seed });
  const r = s.rikishi.find((x) => x.stableId === s.player.stableId && s.banzuke.includes(x.id))!;
  r.injury = 2;
  return { s, id: r.id };
}

describe('けがを押して出場', () => {
  it('休ませると全休、けがは1場所ぶん治る', () => {
    const { s, id } = hurt(3);
    const next = advanceBasho(s);
    const r = next.rikishi.find((x) => x.id === id)!;
    expect(r.recent[0]!.absences).toBe(7);
    expect(r.injury).toBe(1);
  });

  it('強行出場すると取組に出る。けがは治らない（悪化することもある）。判断は1場所かぎり', () => {
    const { s, id } = hurt(3);
    const next = advanceBasho(setPlayHurt(s, id, true));
    const r = next.rikishi.find((x) => x.id === id);
    if (!r) return; // 場所中に引退を申し出て受け入れられた場合
    const rec = r.recent[0]!;
    expect(rec.wins + rec.losses).toBeGreaterThan(0);
    expect(r.injury).toBeGreaterThanOrEqual(2);
    expect(r.playHurt).toBe(false);
  });

  it('けがをしていない弟子・他の部屋の力士には設定できない', () => {
    const s = createGame({ seed: 3 });
    const mine = s.rikishi.find((x) => x.stableId === s.player.stableId)!;
    const other = s.rikishi.find((x) => x.stableId !== s.player.stableId)!;
    other.injury = 1;
    expect(setPlayHurt(s, mine.id, true)).toBe(s);
    expect(setPlayHurt(s, other.id, true)).toBe(s);
  });
});
