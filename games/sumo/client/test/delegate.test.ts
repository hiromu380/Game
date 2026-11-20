import { describe, expect, it } from 'vitest';
import { advanceBasho, createGame } from '@ichimon/sim';
import { delegate, stopReason } from '../src/delegate';
import { play } from '../../sim/test/play';

describe('任せる（早送り）', () => {
  it('任せた数だけ進むか、判断が要ることで止まる。止まらなければ止まったわけは null', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const g = play(seed, 3);
      const r = delegate(g, 6);
      expect(r.steps.length).toBeGreaterThan(0);
      expect(r.steps.length).toBeLessThanOrEqual(6);
      expect(r.game.bashoIndex).toBe(g.bashoIndex + r.steps.length);
      if (r.steps.length < 6) expect(r.stop).not.toBeNull();
      // 同じ入力なら同じ結果
      expect(delegate(g, 6).steps).toEqual(r.steps);
    }
  });

  it('自分の弟子のけがで止まる', () => {
    let injury = 0;
    for (const seed of [1, 2, 3]) {
      let g = play(seed, 5);
      for (let i = 0; i < 6 && !g.gameOver && injury === 0; i++) {
        const r = delegate(g, 6);
        if (r.stop === 'injury') {
          injury++;
          const last = r.steps[r.steps.length - 1]!;
          expect(last.injuries.length + r.game.pending.treatment.length).toBeGreaterThan(0);
        }
        // 止まった判断は済ませたことにして次へ
        g = {
          ...r.game,
          pending: { ...r.game.pending, treatment: [], retireRequests: [], happening: null },
        };
      }
    }
    expect(injury).toBeGreaterThan(0);
  }, 30_000);

  it('関取への昇進で止まる', () => {
    const g = play(2, 3);
    const next = advanceBasho(g);
    const clean = {
      ...next,
      pending: {
        ...next.pending,
        treatment: [],
        retireRequests: [],
        happening: null,
        candidates: [],
        election: null,
        independence: null,
      },
    };
    const step = {
      bashoIndex: 0,
      kachikoshi: 0,
      total: 0,
      up: 0,
      down: 0,
      net: 0,
      promotions: [{ id: 1, to: 'sekitori' as const }],
      injuries: [],
    };
    expect(stopReason(g, clean, step)).toBe('promotion');
  });

  it('お金が尽きそうなら止まる', () => {
    const g = createGame({ seed: 2 });
    const poor = { ...g, player: { ...g.player, stableMoney: 0, personalMoney: 100_000 } };
    const next = advanceBasho(poor);
    const step = {
      bashoIndex: 0,
      kachikoshi: 0,
      total: 0,
      up: 0,
      down: 0,
      net: 0,
      promotions: [],
      injuries: [],
    };
    const reason = stopReason(poor, next, step);
    expect(['money', 'gameOver', 'happening', 'candidate', 'decision']).toContain(reason);
  });
});
