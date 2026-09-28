/**
 * フェーズ2で追加したパーツ11種の挙動テスト
 * 盤面の書き方は test/helpers.ts を参照（1マス = パーツ記号 + 向き）
 */
import { describe, expect, it } from 'vitest';
import {
  BALANCE,
  DEFAULT_RULES,
  computeActivationLimits,
  getPartBadge,
  type SimEvent,
} from '../../src';
import { board, run } from '../helpers';

const only = <T extends SimEvent['type']>(events: SimEvent[], type: T) =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

const P = BALANCE.partParams;

describe('合流炉（倍率系）', () => {
  it('同じ tick に入った信号を合算して1本にする', () => {
    // 分岐器で上下に分けた 1 と 1 が、同じ長さの経路で合流炉(2,1)に同時に入る → 2 を出荷
    const { scoreText, events } = run(['.. C> Cv ..', 'S> Y> M> D>', '.. C> C^ ..']);
    expect(scoreText).toBe('2');
    expect(only(events, 'absorb')).toHaveLength(1);
    expect(only(events, 'activate').filter((e) => e.partId === 'merger')).toHaveLength(1);
  });

  it('別々の tick に入った信号は別々に送る（発動回数は tick ごとに1回）', () => {
    // コピー機の2連射（1 tick ずれ）→ 合流炉が2回発動して、それぞれ出荷
    const { events, stats } = run(['S> X> M> D>']);
    expect(only(events, 'activate').filter((e) => e.partId === 'merger')).toHaveLength(2);
    expect(stats.shipCount).toBe(2);
  });

  it('発動回数を使い切ると消える', () => {
    // 上限を1にすると、コピー機の2発目（別の tick）は消える
    const rules = {
      ...DEFAULT_RULES,
      maxActivations: { ...DEFAULT_RULES.maxActivations, merger: 1 },
    };
    const { events, stats } = run(['S> X> M> D>'], 1, rules);
    expect(stats.shipCount).toBe(1);
    expect(only(events, 'vanish').some((e) => e.reason === 'exhausted')).toBe(true);
  });
});

describe('連鎖メーター（倍率系）', () => {
  it(`値に（連鎖数 ÷ ${P.chainMeterStep} + 1）を掛ける`, () => {
    // コンベア4つ（連鎖4）→ 連鎖メーターは連鎖4の時点で ×1、コンベア5つなら ×2
    expect(run(['S> C> C> C> C> K> D>']).scoreText).toBe('1');
    expect(run(['S> C> C> C> C> C> K> D>']).scoreText).toBe('2');
  });
});

describe('散布機（分岐系）', () => {
  it('前・左・右の3方向へ同じ値で送る', () => {
    const { scoreText } = run(['.. D> ..', 'S> E> D>', '.. D> ..']);
    expect(scoreText).toBe('3');
  });
});

describe('コピー機（分岐系）', () => {
  it(`同じ値を2連射し、2発目は ${P.copierDelay} tick 遅れる`, () => {
    const { scoreText, events } = run(['S> X> D>']);
    expect(scoreText).toBe('2');
    const emits = only(events, 'emit').filter((e) => e.x === 1);
    expect(emits.map((e) => e.tick)).toEqual([1, 1 + P.copierDelay]);
  });
});

describe('反射板（再発動系）', () => {
  it('入ってきた方向へ跳ね返し、同じ経路を戻る', () => {
    // S → C(右) → F で跳ね返って左へ → C（2回目）は右向きなので再び F へ
    // → F の2回目で跳ね返り → C の3回目 → F は上限に達して消滅
    const { events } = run(['S> C> F^']);
    const reflects = only(events, 'activate').filter((e) => e.partId === 'reflector');
    expect(reflects).toHaveLength(BALANCE.parts.reflector.maxActivations!);
    // 跳ね返った信号は左向き（6）
    const firstBounce = only(events, 'emit').find((e) => e.x === 2)!;
    expect(firstBounce.dir).toBe(6);
  });
});

describe('回転台（再発動系）', () => {
  it('発動するたびに出力方向が時計回りに90度回る', () => {
    // 上向きの回転台に2回信号を入れる（コピー機の2連射）: 1回目は上、2回目は右
    const { events } = run(['.. .. D> ..', 'S> X> U^ D>', '.. .. .. ..']);
    const dirs = only(events, 'emit')
      .filter((e) => e.x === 2 && e.y === 1)
      .map((e) => e.dir);
    expect(dirs).toEqual([0, 2]);
  });

  it('盤面上の向き自体は変わらない（シミュレーション中だけの状態）', () => {
    const b = board(['S> X> U^ D>']);
    run(['S> X> U^ D>']);
    expect(b.cells[2]).toEqual({ id: 'turntable', dir: 0 });
  });
});

describe('潤滑油タンク（再発動系）', () => {
  it('信号には反応しない', () => {
    const { events } = run(['S> O^']);
    expect(only(events, 'vanish')[0]?.reason).toBe('inert');
  });

  it(`隣接パーツの発動回数上限を +${P.oilerBonus} する`, () => {
    const limits = computeActivationLimits(board(['.. O^ ..', 'S> G> D>']), DEFAULT_RULES);
    // ギア(1,1) は 1 + 1 = 2。出荷口（無制限）はそのまま
    expect(limits[4]).toBe(BALANCE.parts.gear.maxActivations! + P.oilerBonus);
    expect(limits[5]).toBeNull();
  });

  it('上限が増えたギアは2回発動できる', () => {
    // コピー機の2連射がどちらもギアを通る
    const withOiler = run(['.. .. O^ ..', 'S> X> G> D>']);
    const without = run(['.. .. .. ..', 'S> X> G> D>']);
    expect(withOiler.scoreText).toBe('4');
    expect(without.scoreText).toBe('2');
  });
});

describe('共鳴コイル（配置系）', () => {
  it('値に（1 + 隣接する共鳴コイル数）を掛ける', () => {
    // 3つ並んだコイル: 1つ目 ×2、2つ目 ×3、3つ目 ×2 → 1×2×3×2 = 12
    expect(run(['S> L> L> L> D>']).scoreText).toBe('12');
  });

  it('コイル以外の隣接パーツは数えない', () => {
    expect(run(['.. G^ ..', 'S> L> D>']).scoreText).toBe('1');
  });
});

describe('ソーラーパネル（配置系）', () => {
  it('値に周囲8マスの空きマス数を足す（盤面外は数えない）', () => {
    // 3×3 の中央: 周囲8マスのうち S と D 以外の6マスが空き → 1 + 6 = 7
    expect(run(['.. .. ..', 'S> A> D>', '.. .. ..']).scoreText).toBe('7');
    // 1行の盤面: 周囲は左右のみ（どちらも埋まっている）→ 1 + 0
    expect(run(['S> A> D>']).scoreText).toBe('1');
  });
});

describe('検品台（配置系）', () => {
  it(`隣接に出荷口があれば ×${P.inspectorMultiplier}、なければそのまま`, () => {
    expect(run(['S> I> D>']).scoreText).toBe(String(P.inspectorMultiplier));
    expect(run(['S> I> C> D>']).scoreText).toBe('1');
  });
});

describe('貯金箱（経済系）', () => {
  it(`信号をそのまま送り、予算を +${P.piggyBankIncome} 生む`, () => {
    const result = run(['S> $> D>']);
    expect(result.scoreText).toBe('1');
    expect(result.income).toBe(P.piggyBankIncome);
    expect(only(result.events, 'income')).toHaveLength(1);
  });

  it(`1回のシミュレーションで生める予算は ${BALANCE.sim.maxIncomePerSim} まで`, () => {
    // 貯金箱を5つ直列にしても上限で止まる
    const result = run(['S> $> $> $> $> $> D>']);
    expect(result.income).toBe(BALANCE.sim.maxIncomePerSim);
  });
});

describe('効果量バッジ', () => {
  it('置き場所で決まる効果を返す', () => {
    const b = board(['.. .. ..', 'S> A> D>', 'L> L> I>']);
    const badge = (x: number, y: number) =>
      getPartBadge(b.cells[y * 3 + x]!, b, x, y, DEFAULT_RULES);
    expect(badge(1, 1)).toEqual({ kind: 'add', value: 3 });
    expect(badge(0, 2)).toEqual({ kind: 'mul', value: 2 });
    expect(badge(2, 2)).toEqual({ kind: 'mul', value: P.inspectorMultiplier }); // 上に出荷口
    expect(badge(0, 1)).toBeNull();
  });
});
