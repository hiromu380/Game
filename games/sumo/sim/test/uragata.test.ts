import { describe, expect, it } from 'vitest';
import {
  advanceBasho,
  answerUragata,
  TOKOYAMA_OVER_CAP_DESHI,
  URAGATA_CAP,
  uragataCount,
  uragataOpen,
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

  it('協会全体の定員に空きがなければ迎えられない。床山は弟子12人以上で床山のいない部屋なら定員を超えてよい', () => {
    const g = withApplicant();
    const role = g.pending.uragata!.role;
    expect(uragataOpen(g, role)).toBe(true);
    const before = uragataCount(g, role);
    expect(answerUragata(g, true).uragataCount[role]).toBe(before + 1);
    const full = JSON.parse(JSON.stringify(g)) as GameState;
    full.uragataCount = { ...URAGATA_CAP };
    expect(uragataOpen(full, 'gyoji')).toBe(false);
    expect(uragataOpen(full, 'yobidashi')).toBe(false);
    const mine = full.rikishi.filter((r) => r.stableId === full.player.stableId).length;
    expect(uragataOpen(full, 'tokoyama')).toBe(mine >= TOKOYAMA_OVER_CAP_DESHI);
    if (role !== 'tokoyama' || mine < TOKOYAMA_OVER_CAP_DESHI)
      expect(answerUragata(full, true).player.uragata).toEqual(full.player.uragata);
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
