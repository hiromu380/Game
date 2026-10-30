import { describe, expect, it } from 'vitest';
import {
  advanceBasho,
  chooseTreatment,
  chronicFactor,
  createGame,
  fragilityOf,
  migrateSave,
  setPlayHurt,
  type GameState,
} from '../src';
import { tagInjuries } from '../src/career/injury';

/** 自分の弟子の1人を全治 n 場所のけがにして、部位を付けた状態 */
function hurt(seed: number, n: number): { s: GameState; id: number } {
  const s = createGame({ seed });
  const r = s.rikishi.find((x) => x.stableId === s.player.stableId && s.banzuke.includes(x.id))!;
  r.injury = n;
  tagInjuries(s);
  return { s, id: r.id };
}

describe('けがの部位・治療・古傷', () => {
  it('けがには部位と全治が付き、重いけがは治療の方針を聞かれる', () => {
    const { s, id } = hurt(2, 2);
    const r = s.rikishi.find((x) => x.id === id)!;
    expect(r.wound).toMatchObject({ total: 2, treatment: 'rest' });
    expect(s.pending.treatment).toEqual([id]);
    // 軽いけが（全治1場所）は聞かない
    expect(hurt(2, 1).s.pending.treatment).toEqual([]);
  });

  it('部位は乱数の別の流れで決まり、同じ状態なら同じ部位', () => {
    const a = hurt(5, 2);
    const b = hurt(5, 2);
    const wa = a.s.rikishi.find((x) => x.id === a.id)!.wound;
    expect(b.s.rikishi.find((x) => x.id === b.id)!.wound).toEqual(wa);
  });

  it('手術: 休みが1場所延び、強行出場はできない。日誌に残る', () => {
    const { s, id } = hurt(3, 2);
    const t = chooseTreatment(s, id, 'surgery');
    const r = t.rikishi.find((x) => x.id === id)!;
    expect(r.injury).toBe(3);
    expect(r.wound).toMatchObject({ total: 3, treatment: 'surgery' });
    expect(t.pending.treatment).toEqual([]);
    expect(setPlayHurt(t, id, true)).toBe(t);
    expect(t.journal.some((e) => e.kind === 'injury' && e.event === 'surgery')).toBe(true);
    // 聞かれていない弟子は選べない
    expect(chooseTreatment(t, id, 'rest')).toBe(t);
  });

  it('返事をしないまま場所を進めると保存療法', () => {
    const { s, id } = hurt(4, 2);
    const next = advanceBasho(s);
    const r = next.rikishi.find((x) => x.id === id);
    if (r?.wound) expect(r.wound.treatment).toBe('rest');
    expect(next.pending.treatment).not.toContain(id);
  });

  it('治ると、保存療法の重いけがは古傷になりやすく、手術はなりにくい', () => {
    const count = (treatment: 'rest' | 'surgery') => {
      const s = createGame({ seed: 9 });
      let n = 0;
      for (const r of s.rikishi) {
        r.injury = 0;
        r.wound = { part: 'knee', side: 'L', total: 2, treatment };
      }
      tagInjuries(s);
      for (const r of s.rikishi) {
        expect(r.wound).toBeUndefined();
        if (r.oldInjuries?.includes('knee')) n++;
      }
      return n / s.rikishi.length;
    };
    const rest = count('rest');
    const surgery = count('surgery');
    expect(rest).toBeGreaterThan(0.3);
    expect(rest).toBeLessThan(0.6);
    expect(surgery).toBeLessThan(0.12);
  });

  it('古傷があると、けがをしやすい', () => {
    const s = createGame({ seed: 1 });
    const r = s.rikishi[0]!;
    const before = fragilityOf(r);
    r.oldInjuries = ['knee', 'back'];
    expect(chronicFactor(r)).toBeCloseTo(1.5);
    expect(fragilityOf(r)).toBeCloseTo(before * 1.5);
  });

  it('版16のセーブを読む（治療の方針はまだない）', () => {
    const v = JSON.parse(JSON.stringify(createGame({ seed: 1 })));
    v.version = 16;
    delete v.pending.treatment;
    const m = migrateSave(v)!;
    expect(m.version).toBe(17);
    expect(m.pending.treatment).toEqual([]);
  });
});
