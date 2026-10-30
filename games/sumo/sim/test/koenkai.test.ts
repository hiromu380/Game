import { describe, expect, it } from 'vitest';
import { advanceBasho, createGame, migrateSave, setParty, visitPatron } from '../src';

describe('後援会とタニマチ', () => {
  it('開始時は地元の後援者が1人。会員がいる', () => {
    const s = createGame({ seed: 1 });
    expect(s.player.koenkai.patrons).toHaveLength(1);
    expect(s.player.koenkai.patrons[0]!.kind).toBe('hometown');
    expect(s.player.koenkai.members).toBeGreaterThan(0);
    expect(s.player.koenkai.party).toBe('small');
  });

  it('帳簿に会費とご祝儀が入り、千秋楽パーティーの費用が出る', () => {
    const r = advanceBasho(createGame({ seed: 2 })).lastReport!;
    expect(r.income.find((l) => l.key === 'koenkai')!.amount).toBeGreaterThan(0);
    expect(r.income.find((l) => l.key === 'patrons')!.amount).toBeGreaterThan(0);
    expect(r.expenses.find((l) => l.key === 'party')!.amount).toBe(500_000);
    expect(r.income.some((l) => l.key === 'supporters')).toBe(false);
  });

  it('派手なパーティーは会員と関係が伸び、開かないと費用はないが関係が冷える', () => {
    const s = createGame({ seed: 3 });
    const grand = advanceBasho(setParty(s, 'grand'));
    const none = advanceBasho(setParty(s, 'none'));
    expect(grand.player.koenkai.members).toBeGreaterThan(none.player.koenkai.members);
    expect(grand.player.koenkai.patrons[0]!.favor).toBeGreaterThan(
      none.player.koenkai.patrons[0]!.favor,
    );
    expect(none.lastReport!.expenses.some((l) => l.key === 'party')).toBe(false);
  });

  it('挨拶回り: 親方の貯金から払い、関係が上がる。1つの場所に1回だけ', () => {
    const s = createGame({ seed: 4 });
    const p = s.player.koenkai.patrons[0]!;
    const v = visitPatron(s, p.id);
    expect(v.player.koenkai.patrons[0]!.favor).toBe(p.favor + 12);
    expect(v.player.personalMoney).toBe(s.player.personalMoney - 100_000);
    expect(visitPatron(v, p.id)).toBe(v);
  });

  it('関係が冷えると離れ、日誌に残る', () => {
    const s = createGame({ seed: 5 });
    s.player.koenkai.patrons[0]!.favor = 4;
    const n = advanceBasho(setParty(s, 'none'));
    expect(n.player.koenkai.patrons.some((p) => p.kind === 'hometown' && p.id === 1)).toBe(false);
    expect(n.journal.some((e) => e.kind === 'patron' && e.event === 'leave')).toBe(true);
  });

  it('版14のセーブは、後援会を作って読む', () => {
    const v14 = JSON.parse(JSON.stringify(createGame({ seed: 1 })));
    v14.version = 14;
    delete v14.player.koenkai;
    const m = migrateSave(v14)!;
    expect(m.version).toBe(15);
    expect(m.player.koenkai.patrons.length).toBe(1);
  });
});
