import { describe, expect, it } from 'vitest';
import {
  advanceBasho,
  answerHappening,
  createGame,
  HAPPENINGS,
  migrateSave,
  type GameState,
} from '../src';
import { autoStep, play } from './play';

/** 出来事が起きている状態を作る */
function withHappening(
  id: GameState['happeningLog'][number]['id'],
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
    expect(m.version).toBe(12);
    expect(m.pending.happening).toBeNull();
    expect(m.rikishi.every((r) => r.boost === 1)).toBe(true);
  });

  it('定義: 名前は重ならず、どの出来事にも最後の選択肢（返事をしないときの答え）がある', () => {
    expect(new Set(HAPPENINGS.map((h) => h.id)).size).toBe(HAPPENINGS.length);
    expect(HAPPENINGS.length).toBeGreaterThanOrEqual(50);
    for (const h of HAPPENINGS) {
      expect(h.options.length).toBeGreaterThanOrEqual(2);
      expect(new Set(h.options.map((o) => o.key)).size).toBe(h.options.length);
      for (const o of h.options) if (o.group === 'target') expect(h.target).toBeDefined();
    }
  });

  it('長く進めても、同じ出来事は12場所のうちに続かず、時期の決まった出来事はその時期だけ', () => {
    let s = play(9, 0);
    const seen: { id: string; at: number }[] = [];
    for (let i = 0; i < 90 && !s.gameOver; i++) {
      s = autoStep(s);
      const h = s.pending.happening;
      if (!h) continue;
      const prev = [...seen].reverse().find((x) => x.id === h.id);
      if (prev) expect(s.bashoIndex - prev.at).toBeGreaterThanOrEqual(12);
      seen.push({ id: h.id, at: s.bashoIndex });
      const def = HAPPENINGS.find((d) => d.id === h.id)!;
      if (def.months) expect(def.months).toContain(s.bashoIndex % 6);
      if (def.target) {
        expect(h.target).not.toBeNull();
        expect(s.rikishi.find((r) => r.id === h.target)!.stableId).toBe(s.player.stableId);
      }
    }
    expect(new Set(seen.map((x) => x.id)).size).toBeGreaterThan(15);
  }, 60_000);

  it('確率の選択肢: 結果が日誌に残り、うまくいけば効果が足される', () => {
    const results = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
      const s = createGame({ seed });
      s.pending.happening = { id: 'newSponsor', target: null };
      const next = answerHappening(s, 1);
      const entry = next.journal.at(-1)!;
      expect(entry).toMatchObject({ kind: 'happening', id: 'newSponsor', option: 'askMore' });
      const hit = (entry as { hit?: boolean }).hit!;
      expect(next.player.stableMoney - s.player.stableMoney).toBe(hit ? 2_000_000 : 0);
      return hit;
    });
    expect(results).toContain(true);
    expect(results).toContain(false);
  });

  it('脱走: 待つと、本人が引退を申し出ることがある', () => {
    let asked = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const s = createGame({ seed });
      const r = s.rikishi.find((x) => x.stableId === s.player.stableId)!;
      s.pending.happening = { id: 'runaway', target: r.id };
      if (answerHappening(s, 1).pending.retireRequests.includes(r.id)) asked++;
    }
    expect(asked).toBeGreaterThan(0);
    expect(asked).toBeLessThan(12);
  });
});
