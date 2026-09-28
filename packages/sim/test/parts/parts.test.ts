/**
 * 各パーツの挙動の単体テスト
 */
import { describe, expect, it } from 'vitest';
import { BALANCE, DEFAULT_RULES, type SimEvent } from '../../src';
import { run } from '../helpers';

/** 指定種別のイベントだけ取り出す */
const only = <T extends SimEvent['type']>(events: SimEvent[], type: T) =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);

describe('スイッチ', () => {
  it('tick 0 に向いている方向へ value=1 の信号を発射する', () => {
    const { events } = run(['.. .. ..', '.. Sv ..', '.. .. ..']);
    const [emit] = only(events, 'emit');
    expect(emit).toMatchObject({ tick: 0, x: 1, y: 1, dir: 4, value: 1n });
  });

  it('信号を受けても反応しない（消滅）', () => {
    const { events } = run(['S> S<']);
    expect(only(events, 'vanish').map((e) => e.reason)).toEqual(['inert', 'inert']);
  });
});

describe('出荷口', () => {
  it('受けた値を出荷量に加算する', () => {
    expect(run(['S> D>']).scoreText).toBe('1');
  });

  it('何度でも受け付ける（発動回数無制限）', () => {
    // 分岐器で上下に分けてコンベアで同じ出荷口へ戻す
    const { scoreText, stats } = run(['.. C> Dv', 'S> Y> ..', '.. C> D^']);
    expect(stats.shipCount).toBe(2);
    expect(scoreText).toBe('2');
  });
});

describe('ベルトコンベア', () => {
  it('入ってきた向きに関係なく自身の向きへ送る', () => {
    // 右向きに入ってきた信号を下へ曲げる
    expect(run(['S> Cv', '.. D>']).scoreText).toBe('1');
  });
});

describe('分岐器', () => {
  it('自身の向きから見て左右へ同じ値で送る', () => {
    // 右向きの分岐器 → 上（左手）と下（右手）へ
    const { scoreText, events } = run(['.. D>', 'S> Y>', '.. D>']);
    expect(scoreText).toBe('2');
    const dirs = only(events, 'emit')
      .filter((e) => e.tick === 1)
      .map((e) => e.dir);
    expect(dirs).toEqual([0, 4]);
  });
});

describe('増幅ギア', () => {
  it(`値を ×${BALANCE.partParams.gearMultiplier} して自身の向きへ送る`, () => {
    expect(run(['S> G> D>']).scoreText).toBe(String(BALANCE.partParams.gearMultiplier));
  });

  it('ギアを重ねると倍々で増える', () => {
    const m = BigInt(BALANCE.partParams.gearMultiplier);
    expect(run(['S> G> G> G> D>']).score).toBe(m * m * m);
  });

  it('倍率はルールで変えられる（コードに直書きしていない）', () => {
    const rules = { ...DEFAULT_RULES, params: { ...DEFAULT_RULES.params, gearMultiplier: 10 } };
    expect(run(['S> G> D>'], 1, rules).scoreText).toBe('10');
  });
});

describe('プレス機', () => {
  it('値に（隣接4マスのパーツ数 + 1）を掛ける', () => {
    // プレス(1,1) の隣接: S(0,1), D(2,1), C(1,0), C(1,2) = 4個 → ×5
    const { scoreText } = run(['.. C^ ..', 'S> P> D>', '.. Cv ..']);
    expect(scoreText).toBe('5');
  });

  it('斜めのパーツは数えない', () => {
    // 隣接: S, D の2個 → ×3（斜めの C は数えない）
    expect(run(['C^ .. C^', 'S> P> D>', 'C^ .. C^']).scoreText).toBe('3');
  });
});

describe('爆発ドラム缶', () => {
  it('周囲8方向へ同じ値で同時に発射する', () => {
    const { scoreText, events } = run(['D> D> D>', 'D> B^ D>', 'D> S^ D>']);
    // S は B の真下。B から出る8方向のうち、下（S）以外の7方向が出荷口
    expect(only(events, 'emit').filter((e) => e.tick === 1)).toHaveLength(8);
    expect(scoreText).toBe('7');
  });

  it('発動は1回のみ', () => {
    // 分岐器から上下に分かれた信号が同じドラム缶(2,1)に入っても1回しか爆発しない
    const { events } = run(['.. C> Cv', 'S> Y> B>', '.. C> C^']);
    expect(only(events, 'activate').filter((e) => e.partId === 'barrel')).toHaveLength(1);
  });
});

describe('ポンコツロボ', () => {
  it('シード乱数で決まる上下左右のいずれかへ送る', () => {
    const counts = new Set<number>();
    for (let seed = 0; seed < 30; seed++) {
      const { events } = run(['.. D> ..', 'D> J> D>', '.. S^ ..'], seed);
      const emit = only(events, 'emit').find((e) => e.tick === 1)!;
      expect([0, 2, 4, 6]).toContain(emit.dir);
      counts.add(emit.dir);
    }
    expect(counts.size).toBeGreaterThan(1);
  });
});

describe('再起動装置', () => {
  it('隣接パーツの発動回数をリセットし、自身の向きへ送る', () => {
    // S → G(1,1) → R(2,1) が G をリセットして上へ → C(2,0) 左 → C(1,0) 下 → G(1,1) が2回目の発動
    const { events } = run(['.. Cv C< ..', 'S> G> R^ ..']);
    expect(only(events, 'reset').map((e) => [e.x, e.y])).toContainEqual([1, 1]);
    expect(only(events, 'activate').filter((e) => e.partId === 'gear')).toHaveLength(2);
  });

  it('発動は1シミュレーションにつき1回のみ（既定）', () => {
    const { events } = run(['.. Cv C< ..', 'S> G> R^ ..']);
    expect(only(events, 'activate').filter((e) => e.partId === 'rebooter')).toHaveLength(1);
  });
});

describe('信号の消滅', () => {
  it('盤面外へ出ると消える', () => {
    const { events } = run(['S<']);
    expect(only(events, 'vanish')[0]?.reason).toBe('outOfBoard');
  });

  it('空マスに入ると消える', () => {
    const { events } = run(['S> .. D>']);
    expect(only(events, 'vanish')[0]?.reason).toBe('emptyCell');
    expect(only(events, 'ship')).toHaveLength(0);
  });

  it('発動回数を使い切ったパーツに入ると消える', () => {
    // 分岐器から上下に分かれた信号が、同じ tick に同じギア(2,1)へ入る（ギアは1回まで）
    const { events } = run(['.. C> Cv', 'S> Y> G>', '.. C> C^']);
    expect(only(events, 'vanish').some((e) => e.reason === 'exhausted')).toBe(true);
  });
});
