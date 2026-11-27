import { describe, expect, it } from 'vitest';
import { advanceBasho, createGame, GROWTH, setIntensity, type GameState } from '../src';

/** 自分の弟子（番付に載っている）の1人 */
function pupil(s: GameState) {
  return s.rikishi.find((r) => r.stableId === s.player.stableId && s.banzuke.includes(r.id))!;
}

describe('稽古の量と成果', () => {
  it('場所の結果に、自分の弟子の稽古の成果（能力・体重・疲れの動き）が残る', () => {
    const s = createGame({ seed: 6 });
    const next = advanceBasho(s);
    const t = next.lastReport!.training!;
    const mine = next.rikishi.filter((r) => r.stableId === next.player.stableId);
    expect(t.map((x) => x.id).sort()).toEqual(mine.map((r) => r.id).sort());
    const id = pupil(s).id;
    const before = s.rikishi.find((r) => r.id === id)!;
    const after = next.rikishi.find((r) => r.id === id)!;
    const row = t.find((x) => x.id === id)!;
    expect(row.oshi).toBeCloseTo(after.abilities.oshi - before.abilities.oshi, 5);
    expect(row.intensity).toBe('normal');
  });

  it('猛稽古はよく伸びて疲れがたまり、軽めは伸びが小さく疲れにくい', () => {
    const s = createGame({ seed: 6 });
    const id = pupil(s).id;
    const run = (g: GameState) => advanceBasho(g).lastReport!.training!.find((x) => x.id === id)!;
    const light = run(setIntensity(s, id, 'light'));
    const normal = run(s);
    const hard = run(setIntensity(s, id, 'hard'));
    const sum = (x: typeof normal) => x.oshi + x.yotsu + x.waza;
    if (!light.injured && !normal.injured && !hard.injured) {
      expect(sum(hard)).toBeGreaterThan(sum(normal));
      expect(sum(normal)).toBeGreaterThan(sum(light));
    }
    expect(hard.fatigue - normal.fatigue).toBe(GROWTH.intensity.hard.fatigue);
    expect(light.fatigue).toBeLessThanOrEqual(normal.fatigue);
    expect(hard.intensity).toBe('hard');
  });

  it('稽古の量は自分の弟子だけ。ほかの部屋の力士には付けられない', () => {
    const s = createGame({ seed: 6 });
    const other = s.rikishi.find((r) => r.stableId !== s.player.stableId)!;
    expect(
      setIntensity(s, other.id, 'hard').rikishi.find((r) => r.id === other.id)!.intensity,
    ).toBeUndefined();
  });
});

describe('後半の構え', () => {
  it('前半の取組は変わらず、攻めた弟子は場所の後に疲れが残る。結果に構えが残る', () => {
    const s = createGame({ seed: 9 });
    const id = pupil(s).id;
    const plain = advanceBasho(s);
    const push = advanceBasho(s, { stance: { [id]: 'push' } });
    const firstHalf = (g: GameState) =>
      g.lastReport!.mine.flatMap((m) => m.bouts.filter((b) => b.day <= 8));
    expect(firstHalf(push)).toEqual(firstHalf(plain));
    expect(push.lastReport!.stance).toEqual({ [id]: 'push' });
    expect(plain.lastReport!.stance).toBeUndefined();
    const fatigue = (g: GameState) => g.lastReport!.training!.find((x) => x.id === id)!;
    // 稽古の前の疲れが 8 多いので、稽古の後も多い（上限・下限に当たらなければ同じだけ動く）
    const a = push.rikishi.find((r) => r.id === id);
    const b = plain.rikishi.find((r) => r.id === id);
    if (
      a &&
      b &&
      !fatigue(push).injured &&
      !fatigue(plain).injured &&
      a.injury === 0 &&
      b.injury === 0
    )
      expect(a.fatigue).toBeGreaterThanOrEqual(b.fatigue);
  });

  it('ほかの部屋の力士の構えは受け付けない', () => {
    const s = createGame({ seed: 9 });
    const other = s.rikishi.find((r) => r.stableId !== s.player.stableId)!;
    expect(advanceBasho(s, { stance: { [other.id]: 'push' } })).toEqual(advanceBasho(s));
  });
});
