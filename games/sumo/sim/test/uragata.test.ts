import { describe, expect, it } from 'vitest';
import {
  advanceBasho,
  answerUragata,
  heyatsukiOffers,
  HEYATSUKI,
  inviteHeyatsuki,
  migrateSave,
  SAVE_VERSION,
  URAGATA,
  uragataEffect,
  type GameState,
} from '../src';
import { play } from './play';

/** 裏方の志望者が来ている状態 */
function withApplicant(): GameState {
  let g = play(2, 2);
  for (let i = 0; i < 60; i++) {
    g.player.personalMoney = Math.max(g.player.personalMoney, 100_000_000);
    if (g.pending.uragata) return g;
    g = advanceBasho(g);
  }
  throw new Error('志望者が来ない');
}

describe('裏方（行司・呼出・床山）', () => {
  it('いない役に志望者が来る。迎えると部屋の裏方になり日誌に残る。見送れば何もない', () => {
    const g = withApplicant();
    const a = g.pending.uragata!;
    expect(a.age).toBeGreaterThanOrEqual(URAGATA.age[0]);
    const joined = answerUragata(g, true);
    expect(joined.player.uragata).toEqual([{ ...a, since: g.bashoIndex }]);
    expect(joined.pending.uragata).toBeNull();
    expect(joined.journal.at(-1)).toMatchObject({ kind: 'uragata', role: a.role, event: 'join' });
    expect(joined.player.stableMoney).toBe(g.player.stableMoney);
    const no = answerUragata(g, false);
    expect(no.player.uragata).toEqual(g.player.uragata);
    expect(answerUragata(no, true)).toBe(no);
  });

  it('床山は関取の疲れを抜き、呼出はけがを減らし、行司は名声を足す', () => {
    const g = play(2, 0);
    expect(uragataEffect(g)).toEqual({ sekitoriRecovery: 0, injury: 1, prestige: 0 });
    g.player.uragata = [
      { role: 'tokoyama', name: '床山', age: 20, since: 0 },
      { role: 'yobidashi', name: '克之', age: 20, since: 0 },
      { role: 'gyoji', name: '木村晃之助', age: 20, since: 0 },
    ];
    expect(uragataEffect(g)).toEqual({
      sekitoriRecovery: URAGATA.tokoyamaRecovery,
      injury: URAGATA.yobidashiInjury,
      prestige: URAGATA.gyojiPrestige,
    });
  });

  it('22版のセーブは、裏方なしで読める', () => {
    const old = JSON.parse(JSON.stringify(play(3, 1))) as Record<string, unknown>;
    old.version = 22;
    delete (old.player as Record<string, unknown>).uragata;
    delete (old.pending as Record<string, unknown>).uragata;
    const m = migrateSave(old)!;
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.player.uragata).toEqual([]);
    expect(m.pending.uragata).toBeNull();
  });
});

describe('よその部屋付きの親方を迎える', () => {
  it('同じ一門の、部屋付きの親方が2人以上いる部屋から迎えられる。迎えると何場所かは次を迎えられない', () => {
    const g = play(4, 12);
    const mine = g.stables.find((s) => s.id === g.player.stableId)!;
    const other = g.stables.find((s) => s.id !== mine.id && s.ichimonId === mine.ichimonId)!;
    const base = g.oyakata.find((o) => o.stableId === other.id)!;
    // 先方の部屋に部屋付きの親方を2人置く
    for (const id of [9_000_001, 9_000_002])
      g.oyakata.push({ ...base, id, role: 'heyatsuki', stableId: other.id, name: `名${id}` });
    const offers = heyatsukiOffers(g);
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) {
      const from = g.stables.find((s) => s.id === o.stableId)!;
      expect(from.ichimonId).toBe(mine.ichimonId);
    }
    const pick = offers[0]!;
    const next = inviteHeyatsuki(g, pick.id);
    expect(next.oyakata.find((o) => o.id === pick.id)!.stableId).toBe(g.player.stableId);
    expect(next.journal.at(-1)).toMatchObject({ kind: 'heyatsukiJoin', name: pick.name });
    expect(heyatsukiOffers(next)).toEqual([]);
    next.bashoIndex += HEYATSUKI.cooldown;
    expect(inviteHeyatsuki(g, 123456789)).toBe(g);
  });
});
