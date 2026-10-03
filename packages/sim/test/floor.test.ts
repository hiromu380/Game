/**
 * 床タイル: 効果・適用の条件・決定論・停止性
 */
import { describe, expect, it } from 'vitest';
import { DEFAULT_RULES, scoreOf, simulate } from '../src';
import { board, floorOf, run, runWithFloor } from './helpers';

const P = DEFAULT_RULES.floorParams;

describe('床タイルの効果', () => {
  it('×2床: 上に置いたパーツが発動する直前に値を×2', () => {
    // 1 → ×2床のコンベア 2 → 出荷
    const result = runWithFloor(['S> C> D>'], ['. 2 .']);
    expect(result.scoreText).toBe(String(1 * P.doubleMultiplier));
    expect(result.events.find((e) => e.type === 'floor')).toMatchObject({
      tile: 'double',
      x: 1,
      y: 0,
      before: scoreOf(1),
      after: scoreOf(2),
    });
  });

  it('加算床: 値に +N', () => {
    expect(runWithFloor(['S> C> D>'], ['. + .']).scoreText).toBe(String(1 + P.addAmount));
  });

  it('×3床: 値を×3', () => {
    expect(runWithFloor(['S> C> D>'], ['. 3 .']).scoreText).toBe(String(P.tripleMultiplier));
  });

  it('床はパーツの反応より前に適用する（加算床のギア: (1+3)×2）', () => {
    expect(runWithFloor(['S> G> D>'], ['. + .']).scoreText).toBe(String((1 + P.addAmount) * 2));
  });

  it('出荷口が×2床の上にあると出荷量が倍になる（意図した挙動）', () => {
    expect(runWithFloor(['S> G> D>'], ['. . 2']).scoreText).toBe('4');
  });

  it('床が重なる経路では順に掛かる（×2 → 加算 → ×3）', () => {
    // 1 → ×2 = 2 → +3 = 5 → ×3 = 15
    expect(runWithFloor(['S> C> C> C> D>'], ['. 2 + 3 .']).scoreText).toBe('15');
  });

  it('スイッチの床は効かない（信号を受けて発動するパーツではないため）', () => {
    expect(runWithFloor(['S> D>'], ['2 .']).scoreText).toBe('1');
  });

  it('空マスの床は効かない（信号はそのまま消える）', () => {
    const result = runWithFloor(['S> .. D>'], ['. 2 .']);
    expect(result.scoreText).toBe('0');
    expect(result.events.some((e) => e.type === 'floor')).toBe(false);
  });

  it('発動回数が尽きたパーツの床は効かない', () => {
    // コンベアのループ: 2周目は発動回数切れで消える。床の効果は発動した回数だけ
    const result = runWithFloor(['S> Cv C<', '.. C> C^'], ['. 2 .', '. . .']);
    const floorEvents = result.events.filter((e) => e.type === 'floor');
    const activations = result.events.filter(
      (e) => e.type === 'activate' && e.x === 1 && e.y === 0,
    );
    expect(floorEvents).toHaveLength(activations.length);
    expect(result.events.some((e) => e.type === 'vanish' && e.reason === 'exhausted')).toBe(true);
  });

  it('合流炉は、取り込んだ値の合計に1回だけ床を適用する', () => {
    // 分岐器で上下2本に分け、同じ長さの経路で同じ tick に合流炉へ入れる: (1 + 1) × 2 = 4
    const rows = ['.. C> Cv ..', 'S> Y> M> D>', '.. C> C^ ..'];
    expect(run(rows).scoreText).toBe('2');
    const result = runWithFloor(rows, ['. . . .', '. . 2 .', '. . . .']);
    expect(result.scoreText).toBe('4');
    expect(result.events.filter((e) => e.type === 'floor')).toHaveLength(1);
    expect(result.events.some((e) => e.type === 'absorb')).toBe(true);
  });

  it('使用不可マス: 入った信号は消滅し、上のスイッチも発射しない', () => {
    const blocked = runWithFloor(['S> C> D>'], ['. # .']);
    expect(blocked.scoreText).toBe('0');
    expect(blocked.events.some((e) => e.type === 'vanish' && e.reason === 'blocked')).toBe(true);
    expect(runWithFloor(['S> D>'], ['# .']).events).toHaveLength(0);
  });

  it('床の効果を受けた回数を統計に数える', () => {
    expect(runWithFloor(['S> C> C> D>'], ['. 2 2 2']).stats.floorApplied).toBe(3);
  });
});

describe('床と決定論・停止性', () => {
  it('同じ入力なら同じ結果（床込み）', () => {
    const input = {
      board: board(['S> Jv ..', '.. G> D>']),
      floor: floorOf(['. 2 .', '. + 3']),
      seed: 42,
      rules: DEFAULT_RULES,
    };
    expect(simulate(input)).toEqual(simulate(input));
  });

  it('床を省略した結果と、床のない床を渡した結果は同じ', () => {
    const b = board(['S> G> D>']);
    expect(simulate({ board: b, seed: 1, rules: DEFAULT_RULES })).toEqual(
      simulate({ board: b, floor: floorOf(['. . .']), seed: 1, rules: DEFAULT_RULES }),
    );
  });

  it('環状の盤面を×2床で埋めても、発動回数の上限で止まる', () => {
    const result = runWithFloor(['S> Cv C<', '.. C> C^'], ['2 2 2', '2 2 2']);
    expect(result.stats.halted).toBeNull();
  });

  it('発動回数が無制限の環状の盤面でも、tick 上限で止まり、値の計算も止まる', () => {
    const rules = {
      ...DEFAULT_RULES,
      tickLimit: 200,
      maxActivations: { ...DEFAULT_RULES.maxActivations, conveyor: null },
    };
    // ループを1周するたびに ×3 と +3 が掛かり続ける（値は巨大になるが bigint で正確に計算して止まる）
    const result = runWithFloor(['S> Cv C<', '.. C> C^'], ['. 3 +', '. . .'], 1, rules);
    expect(result.stats.halted).toBe('tickLimit');
    expect(result.events.at(-1)).toMatchObject({ type: 'halt', reason: 'tickLimit', tick: 200 });
    expect(result.stats.maxValue > 10n ** 20n).toBe(true);
  });

  it('再起動装置で自分の床を何度も通る配置も、上限内で止まる', () => {
    const result = runWithFloor(['S> R> Cv', '.. C^ C<'], ['. 2 2', '. 2 2']);
    expect(result.stats.ticks).toBeLessThanOrEqual(DEFAULT_RULES.tickLimit);
  });
});
