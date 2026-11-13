/**
 * フェーズ4で追加したパーツ4種（コイン選別機・中継タワー・蓄電池・仕分け機）の挙動テスト
 * 盤面の書き方は test/helpers.ts を参照（1マス = パーツ記号 + 向き。# 選別機・W 中継タワー・V 蓄電池・Z 仕分け機）
 */
import { describe, expect, it } from 'vitest';
import { BALANCE, DEFAULT_RULES, simulate, type SimEvent } from '../../src';
import { board, floorOf, run } from '../helpers';

const only = <T extends SimEvent['type']>(events: SimEvent[], type: T) =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

const P = BALANCE.partParams;

describe('コイン選別機（経済系）', () => {
  it('値が基準に満たなければ、信号を送るだけで予算は生まない', () => {
    const { scoreText, income } = run(['S> #> D>']);
    expect(scoreText).toBe('1');
    expect(income).toBe(0);
  });

  it('値が基準以上なら予算を生む（床の効果を受けた後の値で判定する）', () => {
    const rules = {
      ...DEFAULT_RULES,
      params: { ...DEFAULT_RULES.params, coinSorterThreshold: 4 },
    };
    // ギア×2 → 2（基準 4 に届かない）
    expect(simulate({ board: board(['S> G> #> D>']), seed: 1, rules }).income).toBe(0);
    // ギア×2 ×2 → 4（届く）
    const met = simulate({ board: board(['S> G> G> #> D>']), seed: 1, rules });
    expect(met.income).toBe(P.coinSorterIncome);
    expect(met.score.toString()).toBe('4');
    // ギア×2 → 2 を、×2床の上の選別機で受けると 4 になって届く
    const onFloor = simulate({
      board: board(['S> G> #> D>']),
      floor: floorOf(['. . 2 .']),
      seed: 1,
      rules,
    });
    expect(onFloor.income).toBe(P.coinSorterIncome);
  });

  it('1回のシミュレーションで生める予算の上限は貯金箱と共通', () => {
    const rules = {
      ...DEFAULT_RULES,
      maxIncomePerSim: 3,
      params: { ...DEFAULT_RULES.params, coinSorterThreshold: 1 },
    };
    const { income, events } = simulate({ board: board(['S> #> #> #> D>']), seed: 1, rules });
    expect(income).toBe(3);
    expect(only(events, 'income').map((e) => e.amount)).toEqual([2, 1]);
  });
});

describe('中継タワー（配置系）', () => {
  it('隣のマスを飛び越えて、2マス先のパーツへ届く', () => {
    // 間のマス(2,0)は空でも、(3,0) の出荷口に届く
    const { scoreText, events } = run(['S> W> .. D>']);
    expect(scoreText).toBe('1');
    const moves = only(events, 'move').map((e) => e.x);
    expect(moves).toEqual([1, 3]);
  });

  it('飛び越えたマスのパーツは発動せず、使用不可マスもまたげる', () => {
    // 間のギアは発動しない（値は 1 のまま）
    const skipped = run(['S> W> G> D>']);
    expect(skipped.scoreText).toBe('1');
    expect(only(skipped.events, 'activate').some((e) => e.partId === 'gear')).toBe(false);
    // 間が使用不可でも届く
    const blocked = simulate({
      board: board(['S> W> .. D>']),
      floor: floorOf(['. . # .']),
      seed: 1,
      rules: DEFAULT_RULES,
    });
    expect(blocked.score.toString()).toBe('1');
  });

  it('届いた先が盤面外・空マスなら消える', () => {
    const out = run(['S> W> ..']);
    expect(only(out.events, 'vanish')[0]).toMatchObject({ reason: 'outOfBoard', x: 3 });
    const empty = run(['S> W> D> ..']);
    expect(empty.scoreText).toBe('0');
    expect(only(empty.events, 'vanish')[0]).toMatchObject({ reason: 'emptyCell', x: 3 });
  });
});

describe('蓄電池（倍率系）', () => {
  it('1本だけなら溜めるだけで何も送らない', () => {
    const { scoreText, events } = run(['S> V> D>']);
    expect(scoreText).toBe('0');
    expect(only(events, 'activate').filter((e) => e.partId === 'battery')).toHaveLength(1);
    expect(only(events, 'emit')).toHaveLength(1); // スイッチの1本だけ
  });

  it('2本目を受けたとき（溜めた値＋受けた値）×倍率を送る', () => {
    // コピー機の2連射: 1 と 1 → (1+1)×2 = 4
    const { scoreText } = run(['S> X> V> D>']);
    expect(scoreText).toBe(String((1 + 1) * P.batteryMultiplier));
    // ギア×2 の後なら (2+2)×2 = 8
    expect(run(['S> G> X> V> D>']).scoreText).toBe(String((2 + 2) * P.batteryMultiplier));
  });

  it('送った後は空に戻り、次の2本でまた送る（発動回数が足りるとき）', () => {
    const rules = {
      ...DEFAULT_RULES,
      maxActivations: { ...DEFAULT_RULES.maxActivations, battery: 4, copier: 2, conveyor: 9 },
    };
    // コピー機2台で 4 本にして蓄電池へ: 2本ずつ送って、4 を2回出荷
    const result = simulate({ board: board(['S> X> X> V> D>']), seed: 1, rules });
    expect(only(result.events, 'ship').map((e) => e.value.toString())).toEqual(['4', '4']);
  });
});

describe('仕分け機（分岐系）', () => {
  it('1本目は左、2本目は右へ送る（本数は増やさない）', () => {
    // 仕分け機(2,1)は右向き: 左 = 上の出荷口、右 = 下の出荷口
    const { events, scoreText } = run(['.. .. D> ..', 'S> X> Z> ..', '.. .. D> ..']);
    expect(scoreText).toBe('2');
    const ships = only(events, 'ship');
    expect(ships.map((e) => e.y)).toEqual([0, 2]);
  });

  it('1本だけなら左へ送る', () => {
    const { events } = run(['.. .. D>', 'S> Z> ..', '.. .. D>']);
    expect(only(events, 'ship')).toHaveLength(0);
    // 仕分け機(1,1)は右向きなので、左 = 上（空マス）へ
    expect(only(events, 'vanish')[0]).toMatchObject({ x: 1, y: 0, reason: 'emptyCell' });
  });
});

describe('追加したパーツと決定論', () => {
  it('同じ盤面・シードなら同じ結果になる', () => {
    const b = board(['S> X> Z> W> .. #> D>', '.. .. V> D> .. .. ..']);
    const a = simulate({ board: b, seed: 7, rules: DEFAULT_RULES });
    const c = simulate({ board: b, seed: 7, rules: DEFAULT_RULES });
    expect(JSON.stringify(a, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).toBe(
      JSON.stringify(c, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
    );
  });
});
