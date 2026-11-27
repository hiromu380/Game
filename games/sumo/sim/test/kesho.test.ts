import { describe, expect, it } from 'vitest';
import {
  advanceBasho,
  answerKesho,
  dokiOf,
  KESHO,
  keshoOptions,
  migrateSave,
  SAVE_VERSION,
  type GameState,
} from '../src';
import { autoStep, play } from './play';

/** 自分の弟子が初めて関取になった直後の状態 */
function newSekitori(): GameState {
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
    let g = play(seed, 0);
    for (let i = 0; i < 60; i++) {
      g.player.stableMoney = Math.max(g.player.stableMoney, 50_000_000);
      g = autoStep(g);
      if (g.pending.kesho.length > 0) return g;
    }
  }
  throw new Error('新十両が見つからない');
}

describe('新十両の化粧まわしと明け荷', () => {
  it('新しい関取が出ると化粧まわしを聞かれ、同期生から明け荷が届いたと日誌に残る', () => {
    const g = newSekitori();
    const id = g.pending.kesho[0]!;
    const akeni = g.journal.find((e) => e.kind === 'akeni');
    expect(akeni).toMatchObject({ kind: 'akeni', doki: dokiOf(g, id) });
    expect(keshoOptions(g)).toContain('borrowed');
    expect(keshoOptions(g)).toContain('stable');
  });

  it('部屋で作ると費用がかかり名声が上がる。借りるのは無料。どれも記録に残り、聞かれなくなる', () => {
    const g = newSekitori();
    const id = g.pending.kesho[0]!;
    const made = answerKesho(g, id, 'stable');
    const money = (x: GameState) => x.player.stableMoney + x.player.personalMoney;
    expect(money(g) - money(made)).toBe(KESHO.cost);
    expect(made.player.prestige).toBe(g.player.prestige + KESHO.stablePrestige);
    expect(made.rikishi.find((r) => r.id === id)!.kesho).toEqual({ from: 'stable' });
    expect(made.pending.kesho).not.toContain(id);
    const lent = answerKesho(g, id, 'borrowed');
    expect(money(lent)).toBe(money(g));
    expect(lent.journal.at(-1)).toMatchObject({ kind: 'kesho', from: 'borrowed' });
    // 聞いていない弟子には何もしない
    expect(answerKesho(lent, id, 'stable')).toBe(lent);
  });

  it('タニマチに頼むと、そのタニマチのひいきになり関係が上がる。関係が浅ければ頼めない', () => {
    const g = newSekitori();
    const id = g.pending.kesho[0]!;
    g.player.koenkai.patrons.forEach((p) => (p.favor = 10));
    expect(keshoOptions(g)).not.toContain('patron');
    expect(answerKesho(g, id, 'patron')).toBe(g);
    const p = g.player.koenkai.patrons[0];
    if (!p) return;
    p.favor = 60;
    const asked = answerKesho(g, id, 'patron');
    const after = asked.player.koenkai.patrons.find((x) => x.id === p.id)!;
    expect(after.favoriteId).toBe(id);
    expect(after.favor).toBe(60 + KESHO.patronFavorGain);
    expect(asked.rikishi.find((r) => r.id === id)!.kesho).toEqual({
      from: 'patron',
      by: p.surname,
    });
  });

  it('返事をしないで場所を進めると、師匠のを借りる', () => {
    const g = newSekitori();
    const id = g.pending.kesho[0]!;
    const next = advanceBasho(g);
    expect(next.rikishi.find((r) => r.id === id)?.kesho?.from ?? 'borrowed').toBe('borrowed');
    expect(next.pending.kesho).not.toContain(id);
  });

  it('19版のセーブは、化粧まわしを聞いていない状態で読める', () => {
    const old = JSON.parse(JSON.stringify(play(3, 1))) as Record<string, unknown>;
    old.version = 19;
    delete (old.pending as Record<string, unknown>).kesho;
    const m = migrateSave(old)!;
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.pending.kesho).toEqual([]);
  });
});
