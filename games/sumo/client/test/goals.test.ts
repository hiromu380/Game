import { describe, expect, it } from 'vitest';
import { createGame } from '@ichimon/sim';
import { GOAL_IDS, GOAL_SEKITORI, goalsOf, nextGoal } from '../src/goals';
import ja from '../src/i18n/ja.json';
import en from '../src/i18n/en.json';
import { play } from '../../sim/test/play';

describe('部屋の歩み', () => {
  it('始めたばかりは何も越えていない。次の目標は三段目', () => {
    const goals = goalsOf(createGame({ seed: 2 }));
    expect(goals.map((g) => g.id)).toEqual([...GOAL_IDS]);
    expect(goals.every((g) => !g.done)).toBe(true);
    expect(nextGoal(goals)?.id).toBe('sandanme');
  });

  it('最高位から節目を数える（上の段に届けば、下の段の節目も越えている）', () => {
    const g = createGame({ seed: 2 });
    const r = g.rikishi.find((x) => x.stableId === g.player.stableId)!;
    r.career.basho = 30;
    r.career.sekitoriBasho = 6;
    r.career.highestRank = { division: 'makuuchi', title: 'K', number: 1, side: 'E' };
    const done = goalsOf(g)
      .filter((x) => x.done)
      .map((x) => x.id);
    expect(done).toEqual(['sandanme', 'makushita', 'sekitori', 'makuuchi', 'sanyaku']);
    const three = goalsOf(g).find((x) => x.id === 'sekitori3')!;
    expect(three.progress).toEqual({ now: 1, of: GOAL_SEKITORI });
    r.career.highestRank = { division: 'makuuchi', title: 'Y', number: 1, side: 'E' };
    r.career.makuuchiYusho = 2;
    const top = goalsOf(g);
    expect(top.find((x) => x.id === 'ozeki')!.done).toBe(true);
    expect(top.find((x) => x.id === 'yokozuna')!.done).toBe(true);
    expect(top.find((x) => x.id === 'yusho')!.done).toBe(true);
    expect(nextGoal(top)?.id).toBe('sekitori3');
  });

  it('元弟子の歩みも数える。越えた節目は戻らない', () => {
    let before = 0;
    for (const basho of [6, 30, 60]) {
      const done = goalsOf(play(3, basho)).filter((x) => x.done).length;
      expect(done).toBeGreaterThanOrEqual(before);
      before = done;
    }
    expect(before).toBeGreaterThan(0);
  });

  it('節目の名前と手がかりが日本語・英語にある', () => {
    for (const id of GOAL_IDS) {
      for (const k of ['name', 'hint']) {
        expect(ja).toHaveProperty([`goals.${id}.${k}`]);
        expect(en).toHaveProperty([`goals.${id}.${k}`]);
      }
    }
  });
});
