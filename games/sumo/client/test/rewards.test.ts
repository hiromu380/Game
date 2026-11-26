import { describe, expect, it } from 'vitest';
import { advanceBasho, type GameState } from '@ichimon/sim';
import { KIMARITE_NEWS_MAX, rewardsOf } from '../src/rewards';
import ja from '../src/i18n/ja.json';
import en from '../src/i18n/en.json';
import { play } from '../../sim/test/play';

describe('報酬と罰', () => {
  it('報酬が先、罰が後。場所を進める前と後が同じ状態なら空', () => {
    for (const seed of [3, 5]) {
      let g = play(seed, 40);
      for (let i = 0; i < 4; i++) {
        const n = advanceBasho(g);
        const lines = rewardsOf(g, n);
        const firstBad = lines.findIndex((x) => x.tone === 'bad');
        if (firstBad >= 0) expect(lines.slice(firstBad).every((x) => x.tone === 'bad')).toBe(true);
        g = n;
      }
      expect(rewardsOf(g, { ...g, lastReport: null })).toEqual([]);
    }
  });

  it('ひいきの力士が負け越すとタニマチの関係が下がり、そのわけが付く', () => {
    let found = false;
    for (const seed of [5, 6, 7]) {
      if (found) break;
      let g = play(seed, 30);
      for (let i = 0; i < 8 && !found; i++) {
        const n = advanceBasho(g);
        for (const x of rewardsOf(g, n)) {
          if (x.kind === 'patrons' && x.cause?.result === 'makekoshi') {
            found = true;
            expect(x.tone).toBe('bad');
            expect(x.delta).toBeLessThan(0);
            expect(x.count).toBeGreaterThan(0);
          }
        }
        g = n;
      }
    }
    expect(found).toBe(true);
  });

  it('変化で勝った弟子は罰に出る', () => {
    const g = play(5, 2);
    const n = advanceBasho(g);
    const id = n.lastReport!.mine[0]!.id;
    const withHenka = { ...n, lastReport: { ...n.lastReport!, henka: [id] } };
    const line = rewardsOf(g, withHenka).find((x) => x.kind === 'henka');
    expect(line).toEqual({
      tone: 'bad',
      kind: 'henka',
      name: n.rikishi.find((r) => r.id === id)!.name,
    });
  });

  it('新しくけがをした弟子だけを罰に出す（休場が続くだけの弟子は出さない）', () => {
    const g = play(5, 40);
    const n = advanceBasho(g);
    const hurt = rewardsOf(g, n).filter((x) => x.kind === 'injury');
    const mine = (s: GameState) => s.rikishi.filter((r) => r.stableId === s.player.stableId);
    for (const x of hurt) {
      const before = mine(g).find((r) => r.name === x.name)!;
      expect(before.injury).toBe(0);
      expect(x.basho).toBeGreaterThan(0);
    }
  });

  it('文言が日本語・英語にある', () => {
    for (const k of [
      'rewards.title',
      'rewards.label.prestige',
      'rewards.label.patrons.kachikoshi',
      'rewards.label.patrons.promoted',
      'rewards.label.patrons.makekoshi',
      'rewards.label.patrons.cold',
      'rewards.chip.patronJoin',
      'rewards.chip.patronLeave',
      'rewards.label.sekitoriUp',
      'rewards.label.sekitoriDown',
      'rewards.label.injury',
      'rewards.chip.perBasho',
      'rewards.label.vsOutlook',
      'rewards.label.honmei',
      'rewards.chip.honmei',
      'honmei.set',
      'honmei.unset',
      'honmei.hit',
      'honmei.effect',
      'outlook.runway',
      'outlook.heads',
      'outlook.headsDesc',
      'candidates.perHead',
    ]) {
      expect(ja).toHaveProperty([k]);
      expect(en).toHaveProperty([k]);
    }
  });
});

describe('決まり手帳の知らせ', () => {
  it('新しく入った決まり手だけを、上限まで知らせる', () => {
    let g = play(4, 1);
    for (let i = 0; i < 6; i++) {
      const next = advanceBasho(g);
      const lines = rewardsOf(g, next).filter((x) => x.kind === 'kimarite');
      expect(lines.length).toBeLessThanOrEqual(KIMARITE_NEWS_MAX);
      g = next;
    }
  });
});
