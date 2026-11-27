import { describe, expect, it } from 'vitest';
import {
  advanceBasho,
  answerPledge,
  migrateSave,
  PLEDGES,
  pledgeKept,
  SAVE_VERSION,
  type GameState,
} from '../src';
import { autoStep, play } from './play';

describe('後援会との約束', () => {
  it('年の初めに約束を聞かれる。返事をしないで進めると流れる', () => {
    const g = play(3, 6);
    expect(g.bashoIndex % 6).toBe(0);
    expect(g.pending.pledge).toContain('kachikoshi');
    const next = advanceBasho(g);
    expect(next.player.pledge).toBeNull();
    expect(next.pending.pledge).toBeNull();
  });

  it('約束すると支度金が口座に入り、日誌に残る。出ていない約束・しないも受ける', () => {
    const g = play(3, 6);
    const made = answerPledge(g, 'sekitori');
    expect(made.player.stableMoney - g.player.stableMoney).toBe(PLEDGES.sekitori.advance);
    expect(made.player.pledge).toMatchObject({ kind: 'sekitori', kk: 0, mk: 0, done: false });
    expect(made.pending.pledge).toBeNull();
    expect(made.journal.at(-1)).toMatchObject({
      kind: 'pledge',
      pledge: 'sekitori',
      result: 'made',
    });
    const none = answerPledge(g, null);
    expect(none.player.pledge).toBeNull();
    expect(none.player.stableMoney).toBe(g.player.stableMoney);
    expect(answerPledge(none, 'kachikoshi')).toBe(none);
  });

  it('勝ち越しの約束は、勝ち越しの割合で決まる。ほかは届いたかで決まる', () => {
    const base = { since: 0, baseline: 2, done: false };
    expect(pledgeKept({ kind: 'kachikoshi', kk: 0, mk: 0, ...base })).toBe(false);
    expect(pledgeKept({ kind: 'kachikoshi', kk: 5, mk: 5, ...base })).toBe(true);
    expect(pledgeKept({ kind: 'kachikoshi', kk: 1, mk: 9, ...base })).toBe(false);
    expect(pledgeKept({ kind: 'sekitori', kk: 9, mk: 0, ...base })).toBe(false);
    expect(pledgeKept({ kind: 'sekitori', kk: 0, mk: 9, ...base, done: true })).toBe(true);
  });

  /** 年の終わり（九州場所）の前の状態 */
  function yearEnd(): GameState {
    let g = play(3, 6);
    for (let i = 0; i < 5; i++) g = autoStep(g);
    expect(g.bashoIndex % 6).toBe(5);
    return g;
  }

  it('年の終わりに果たせば名声が上がる。破れば支度金を返し、名声・会員・タニマチの関係が下がる', () => {
    const g = yearEnd();
    g.player.prestige = 20;
    const plain = advanceBasho(g);
    const kept: GameState = JSON.parse(JSON.stringify(g));
    kept.player.pledge = { kind: 'kachikoshi', since: 0, kk: 50, mk: 0, baseline: 2, done: false };
    const k = advanceBasho(kept);
    expect(k.lastReport!.pledge).toEqual({ kind: 'kachikoshi', kept: true });
    expect(k.player.prestige).toBe(plain.player.prestige + PLEDGES.kachikoshi.prestige);
    expect(k.player.pledge).toBeNull();
    expect(k.journal.some((e) => e.kind === 'pledge' && e.result === 'kept')).toBe(true);

    const broken: GameState = JSON.parse(JSON.stringify(g));
    broken.player.pledge = { kind: 'division', since: 0, kk: 0, mk: 0, baseline: -9, done: false };
    const b = advanceBasho(broken);
    expect(b.lastReport!.pledge).toEqual({ kind: 'division', kept: false });
    expect(b.player.prestige).toBeLessThan(plain.player.prestige);
    expect(plain.player.stableMoney - b.player.stableMoney).toBe(PLEDGES.division.advance);
    expect(b.player.koenkai.members).toBeLessThan(plain.player.koenkai.members);
    // 同じ入力なら同じ結果
    expect(advanceBasho(broken)).toEqual(b);
  });

  it('18版のセーブは、約束なしで読める', () => {
    const g = play(3, 1) as unknown as Record<string, unknown> & GameState;
    const old = JSON.parse(JSON.stringify(g)) as unknown as Record<string, unknown>;
    old.version = 18;
    delete (old.player as Record<string, unknown>).pledge;
    delete (old.pending as Record<string, unknown>).pledge;
    const m = migrateSave(old)!;
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.player.pledge).toBeNull();
    expect(m.pending.pledge).toBeNull();
  });
});
