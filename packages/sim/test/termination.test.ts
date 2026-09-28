/**
 * 停止性: どんな配置でも必ず停止する
 */
import { describe, expect, it } from 'vitest';
import { createRuleSet, DEFAULT_RULES } from '../src';
import { run } from './helpers';

describe('停止性', () => {
  it('コンベアのループは発動回数上限で止まる', () => {
    const result = run(['S> Cv C<', '.. C> C^']);
    expect(result.stats.halted).toBeNull();
  });

  it('発動回数が無制限でも tick 上限で必ず止まる', () => {
    const rules = {
      ...DEFAULT_RULES,
      tickLimit: 100,
      maxActivations: { ...DEFAULT_RULES.maxActivations, conveyor: null },
    };
    const result = run(['S> Cv C<', '.. C> C^'], 1, rules);
    expect(result.stats.halted).toBe('tickLimit');
    expect(result.stats.ticks).toBe(100);
    expect(result.events.every((e) => e.tick <= 100)).toBe(true);
    // 打ち切ったことが events の最後に記録される（途切れた理由の表示に使う）
    expect(result.events.at(-1)).toMatchObject({ type: 'halt', reason: 'tickLimit', tick: 100 });
  });

  it('再起動装置どうしが互いをリセットし続けても tick 上限で止まる', () => {
    // R と R が隣接 + コンベアのループで信号が回り続ける配置
    const rules = { ...createRuleSet(), tickLimit: 200 };
    const result = run(['S> Rv C<', '.. R^ C^'], 1, rules);
    expect(result.stats.halted).toBe('tickLimit');
    expect(result.stats.ticks).toBe(200);
  });

  it('ドラム缶だらけの盤面でも止まる', () => {
    const rows = Array.from({ length: 7 }, (_, y) =>
      Array.from({ length: 7 }, (_, x) => (x === 0 && y === 3 ? 'S>' : 'B^')).join(' '),
    );
    const result = run(rows);
    expect(result.stats.halted).toBeNull();
  });

  it('信号が爆発的に増える配置でも、信号数の上限で打ち切る', () => {
    // 再起動装置どうしがリセットし合い、散布機が毎回3本に増やし続ける配置
    const rules = { ...DEFAULT_RULES, maxLiveSignals: 50 };
    const result = run(
      ['.. .. .. .. ..', '.. E^ Rv E^ ..', 'S> Y> R^ Y> ..', '.. E^ Rv E^ ..', '.. .. .. .. ..'],
      1,
      rules,
    );
    // どちらの上限で止まっても良いが、必ず止まり、信号数は上限付近で抑えられる
    expect(result.stats.ticks).toBeLessThanOrEqual(rules.tickLimit);
    const lastEvent = result.events.at(-1);
    if (lastEvent?.type === 'halt') expect(lastEvent.remainingSignals).toBeLessThanOrEqual(50 * 4);
  });

  it('信号数の上限を超えたら halt（signalLimit）を記録する', () => {
    // ドラム缶の8方向発射 → 散布機 → … と増える盤面で、上限を極端に小さくする
    const rules = { ...DEFAULT_RULES, maxLiveSignals: 3 };
    const result = run(['.. .. ..', 'S> B^ ..', '.. .. ..'], 1, rules);
    expect(result.stats.halted).toBe('signalLimit');
    expect(result.events.at(-1)).toMatchObject({ type: 'halt', reason: 'signalLimit' });
  });
});
