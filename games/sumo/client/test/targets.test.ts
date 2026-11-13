import { describe, expect, it } from 'vitest';
import {
  advanceBasho,
  BOUTS,
  createGame,
  ranksOf,
  type BashoRecord,
  type GameState,
  type Rank,
} from '@ichimon/sim';
import { makeT } from '../src/i18n';
import { reached, targetOf, targetText, targetWins } from '../src/targets';
import { play } from '../../sim/test/play';

const t = makeT('ja');

function at(g: GameState, f: (k: Rank) => boolean) {
  const ranks = ranksOf(g.banzuke, g.titles);
  const id = g.banzuke.find((x) => f(ranks.get(x)!))!;
  return { r: g.rikishi.find((x) => x.id === id)!, ranks };
}
const rec = (rank: Rank, wins: number, yusho = false): BashoRecord => ({
  bashoIndex: 0,
  rank,
  wins,
  losses: 15 - wins,
  absences: 0,
  yusho,
});

describe('弟子の近い目標', () => {
  it('段の頭（筆頭）は勝ち越せば上の段へ。下の方ほど多く勝つ必要がある', () => {
    const g = play(3, 30);
    const top = at(g, (k) => k.division === 'makushita' && k.number === 1);
    const tt = targetOf(g, top.r, top.ranks)!.target;
    expect(tt).toEqual({ kind: 'up', to: 'juryo', wins: BOUTS.lower / 2 + 0.5 });
    const low = at(g, (k) => k.division === 'makushita' && k.number === 30);
    const lt = targetOf(g, low.r, low.ranks)!.target;
    expect(targetWins(lt)!).toBeGreaterThan(targetWins(tt)!);
  });

  it('序ノ口は勝ち越せば序二段（文言にもなる）', () => {
    const g = createGame({ seed: 4 });
    const one = at(g, (k) => k.division === 'jonokuchi');
    const x = targetOf(g, one.r, one.ranks)!.target;
    expect(x.kind).toBe('up');
    expect(targetText(t, x)).toMatch(/^\d勝で序二段$/);
  });

  it('関取で上の段まで遠ければ、まず勝ち越し。十両の下の方は「負け越すと幕下」', () => {
    const g = play(5, 60);
    const bottom = at(g, (k) => k.division === 'juryo' && k.number === 14);
    const info = targetOf(g, bottom.r, bottom.ranks)!;
    expect(info.danger).toBe('makushita');
    expect(['up', 'kachikoshi']).toContain(info.target.kind);
    expect(targetWins(info.target)!).toBeLessThanOrEqual(13);
    const head = at(g, (k) => k.division === 'juryo' && k.number === 1);
    expect(targetOf(g, head.r, head.ranks)!.danger).toBeNull();
  });

  it('関脇は直近3場所の三役の勝ち星から、大関に要る勝ち星を出す。大関のカド番・横綱', () => {
    const g = play(5, 60);
    const s = at(g, (k) => k.title === 'S');
    const sek = { ...s.r, recent: [rec(s.ranks.get(s.r.id)!, 12), rec(s.ranks.get(s.r.id)!, 11)] };
    expect(targetOf(g, sek, s.ranks)!.target).toEqual({ kind: 'up', to: 'ozeki', wins: 10 });
    const o = at(g, (k) => k.title === 'O');
    const ozekiRank = o.ranks.get(o.r.id)!;
    const kado = { ...o.r, recent: [rec(ozekiRank, 6)] };
    expect(targetOf(g, kado, o.ranks)!.target).toEqual({ kind: 'kadoban', wins: 8 });
    const tsuna = { ...o.r, recent: [rec(ozekiRank, 14, true)] };
    expect(targetOf(g, tsuna, o.ranks)!.target).toEqual({ kind: 'up', to: 'yokozuna', wins: 12 });
    const y = at(g, (k) => k.title === 'Y');
    if (y.r) expect(targetOf(g, y.r, y.ranks)!.target.kind).toBe('yusho');
  });

  it('見積もりは番付編成と合う: 目標の勝ち星を挙げた幕下以下の弟子は、たいてい上の段へ上がる', () => {
    let hit = 0;
    let total = 0;
    for (const seed of [1, 2, 3, 4]) {
      let g = play(seed, 10);
      for (let i = 0; i < 12; i++) {
        const before = g;
        const ranks = ranksOf(before.banzuke, before.titles);
        g = advanceBasho(before);
        const after = ranksOf(g.banzuke, g.titles);
        for (const m of g.lastReport!.mine) {
          const r = before.rikishi.find((x) => x.id === m.id);
          const info = r && targetOf(before, r, ranks);
          if (!info || info.target.kind !== 'up' || !after.get(m.id)) continue;
          if (!['jonidan', 'sandanme', 'makushita', 'juryo'].includes(info.target.to)) continue;
          if (!reached(info.target, m.record.wins)) continue;
          total++;
          if (after.get(m.id)!.division === info.target.to) hit++;
        }
      }
    }
    expect(total).toBeGreaterThan(5);
    expect(hit / total).toBeGreaterThan(0.7);
  });
});
