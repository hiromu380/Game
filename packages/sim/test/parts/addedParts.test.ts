/**
 * SIM_VERSION 9 で追加したパーツ8種の挙動テスト（盤面の書き方は test/helpers.ts）
 */
import { describe, expect, it } from 'vitest';
import { BALANCE, DEFAULT_RULES, getPartBadge, simulate, type SimEvent } from '../../src';
import { board, run } from '../helpers';

const only = <T extends SimEvent['type']>(events: SimEvent[], type: T) =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
const P = BALANCE.partParams;

describe('曲がりレール', () => {
  it('進んできた向きから時計回りに90度曲げる（自身の向きは関係ない）', () => {
    // 右へ進む信号 → 下へ曲がる → 出荷口
    expect(run(['S> W^', '.. Dv']).scoreText).toBe('1');
    expect(run(['S> W<', '.. Dv']).scoreText).toBe('1');
  });

  it('2つで折り返す（右 → 下 → 左）。発動回数の上限まで通れる', () => {
    const { scoreText, events } = run(['S> W^', 'D> W^']);
    expect(scoreText).toBe('1');
    expect(only(events, 'activate').filter((e) => e.partId === 'bend')).toHaveLength(2);
    expect(BALANCE.parts.bend.maxActivations).toBeGreaterThan(1);
  });
});

describe('十字分岐器', () => {
  it('前・左・右・後ろの4方向へ、値を割って送る（切り捨て）', () => {
    // 値 4（ギア2つ）→ 十字分岐器（右向き）→ 前・上・下の出荷口へ 2 ずつ。後ろはギアへ戻る（発動済みで消える）
    const { scoreText } = run(['.. .. .. D^ ..', 'S> G> G> H> D>', '.. .. .. Dv ..']);
    expect(scoreText).toBe(String((4 / P.crossSplitterDivisor) * 3));
  });

  it('値 1 は 0 になる（切り捨て）', () => {
    expect(run(['.. D^ ..', 'S> H> D>', '.. Dv ..']).scoreText).toBe('0');
  });
});

describe('磁石', () => {
  it('同じ行・列の出荷口の数＋1 を掛ける（隣接していなくてよい）', () => {
    // 磁石(1,1): 同じ行に出荷口(3,1)、同じ列に出荷口(1,0)・(1,2) → ×4、行の出荷口へ届く
    const b = board(['.. D> .. ..', 'S> N> C> D>', '.. D> .. ..']);
    expect(simulate({ board: b, seed: 1, rules: DEFAULT_RULES }).score).toBe(4n);
    expect(getPartBadge(b.cells[5]!, b, 1, 1, DEFAULT_RULES)).toEqual({ kind: 'mul', value: 4 });
  });
});

describe('隅の作業台', () => {
  it('端なら ×2、角なら ×4、内側ならそのまま', () => {
    const corner = ['S> Qv', '.. D>'];
    expect(run(corner).scoreText).toBe(String(P.cornerBenchCorner));
    // 3×3 の上の辺の中央（端・角ではない）
    expect(run(['S> Qv ..', '.. Dv ..', '.. .. ..']).scoreText).toBe(String(P.cornerBenchEdge));
    expect(run(['.. .. .. ..', 'S> Q> D> ..', '.. .. .. ..']).scoreText).toBe('1');
  });
});

describe('蓄電器', () => {
  it('1本目は溜め、2本目で（溜めた値＋今の値）× 倍率を送る', () => {
    // コピー機の2連射（1 と 1）→ 蓄電器 → 出荷口: (1 + 1) × 2 = 4
    const { scoreText, events } = run(['S> X> Z> D>']);
    expect(scoreText).toBe(String(2 * P.capacitorMultiplier));
    expect(only(events, 'activate').filter((e) => e.partId === 'capacitor')).toHaveLength(2);
    // 演出用: 溜めた（値 1）→ 放出して空になった（null）
    expect(only(events, 'store').map((e) => e.value)).toEqual([1n, null]);
  });

  it('1本しか来なければ何も送らない', () => {
    expect(run(['S> Z> D>']).scoreText).toBe('0');
  });
});

describe('転送装置', () => {
  it('いちばん近い別の転送装置から、進んできた向きのまま送り出す', () => {
    // 上の段の転送装置(1,0) → 下の段の転送装置(1,2) から右へ → 出荷口(2,2)
    const { scoreText, events } = run(['S> T> ..', '.. .. ..', '.. T^ D>']);
    expect(scoreText).toBe('1');
    // 行き先の転送装置は発動しない
    expect(only(events, 'activate').filter((e) => e.partId === 'teleporter')).toHaveLength(1);
    // 演出用: 入口から行き先への転送を記録する
    expect(only(events, 'teleport')).toEqual([
      expect.objectContaining({ x: 1, y: 0, toX: 1, toY: 2 }),
    ]);
  });

  it('ほかに転送装置がなければ、そのまま通り抜ける', () => {
    const { scoreText, events } = run(['S> T> D>']);
    expect(scoreText).toBe('1');
    expect(only(events, 'teleport')).toHaveLength(0);
  });
});

describe('ブースター', () => {
  it('値に足してから送る（掛け算の前に置くと効く）', () => {
    expect(run(['S> !> D>']).scoreText).toBe(String(1 + P.boosterAdd));
    expect(run(['S> !> G> D>']).scoreText).toBe(String((1 + P.boosterAdd) * 2));
  });
});

describe('換金機', () => {
  it('信号を消して、値の桁数ぶん予算を生む（出荷量にはならない）', () => {
    // 1 + 5 = 6（1桁）→ 予算 +1
    const r = run(['S> !> %>']);
    expect(r.scoreText).toBe('0');
    expect(r.income).toBe(P.cashierPerDigit);
    // 値 12（2桁）→ +2
    expect(run(['S> !> G> %>']).income).toBe(2 * P.cashierPerDigit);
  });
});
