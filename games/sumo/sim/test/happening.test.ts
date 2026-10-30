import { describe, expect, it } from 'vitest';
import type { HAPPENINGS } from '../src';
import { advanceBasho, answerHappening, createGame, migrateSave, type GameState } from '../src';

/** 出来事が起きている状態を作る */
function withHappening(
  id: (typeof HAPPENINGS)[number]['id'],
  target: number | null = null,
): GameState {
  const s = createGame({ seed: 4 });
  s.pending.happening = { id, target };
  return s;
}

describe('場所の間の出来事', () => {
  it('同じシードなら同じ出来事が起きる。何場所かのうちに起きる', () => {
    let a = createGame({ seed: 10 });
    let b = createGame({ seed: 10 });
    let seen = 0;
    for (let i = 0; i < 6; i++) {
      a = advanceBasho(a);
      b = advanceBasho(b);
      expect(a.pending.happening).toEqual(b.pending.happening);
      if (a.pending.happening) seen++;
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('後援会の会合: 親方だけで出ると口座が増える。答えると出来事は消える', () => {
    const s = withHappening('supporterParty');
    const next = answerHappening(s, 1);
    expect(next.player.stableMoney).toBe(s.player.stableMoney + 300_000);
    expect(next.pending.happening).toBeNull();
  });

  it('名医の紹介: けがの弟子の治りが1場所早まり、費用を払う', () => {
    const s = createGame({ seed: 4 });
    const r = s.rikishi.find((x) => x.stableId === s.player.stableId)!;
    r.injury = 2;
    s.pending.happening = { id: 'famousDoctor', target: r.id };
    const next = answerHappening(s, 0);
    expect(next.rikishi.find((x) => x.id === r.id)!.injury).toBe(1);
    expect(next.player.stableMoney).toBe(s.player.stableMoney - 500_000);
  });

  it('有望な中学生の噂: 会いに行くと素質の高い入門希望者が増える', () => {
    const s = withHappening('promisingKid');
    const next = answerHappening(s, 0);
    expect(next.pending.candidates.length).toBe(s.pending.candidates.length + 1);
    expect(next.pending.candidates.at(-1)!.talent).toBeGreaterThanOrEqual(60);
  });

  it('出稽古: 幕下以上の弟子の次の稽古が伸びる（稽古のあと元に戻る）', () => {
    const s = withHappening('demegeiko');
    const r = s.rikishi.find((x) => x.stableId === s.player.stableId)!;
    // 弟子を幕下に置いたことにする
    s.banzuke = s.banzuke.filter((id) => id !== r.id);
    s.banzuke.splice(100, 0, r.id);
    const next = answerHappening(s, 0);
    expect(next.rikishi.find((x) => x.id === r.id)!.boost).toBe(1.25);
    expect(advanceBasho(next).rikishi.find((x) => x.id === r.id)?.boost ?? 1).toBe(1);
  });

  it('返事をしないまま場所を進めると断ったことになる', () => {
    const s = withHappening('kidsSumo');
    const next = advanceBasho(s);
    expect(next.player.prestige).toBeLessThan(1.5);
  });

  it('版7のセーブを今の版に変換できる', () => {
    const v7 = JSON.parse(JSON.stringify(createGame({ seed: 1 })));
    v7.version = 7;
    delete v7.pending.happening;
    for (const r of v7.rikishi) delete r.boost;
    const m = migrateSave(v7)!;
    expect(m.version).toBe(8);
    expect(m.pending.happening).toBeNull();
    expect(m.rikishi.every((r) => r.boost === 1)).toBe(true);
  });
});
