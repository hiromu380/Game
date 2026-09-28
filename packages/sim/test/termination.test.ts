/**
 * 停止性: どんな配置でも必ず停止する
 */
import { describe, expect, it } from 'vitest';
import { createRuleSet, DEFAULT_RULES } from '../src';
import { run } from './helpers';

describe('停止性', () => {
  it('コンベアのループは発動回数上限で止まる', () => {
    const result = run(['S> Cv C<', '.. C> C^']);
    expect(result.stats.haltedByTickLimit).toBe(false);
  });

  it('発動回数が無制限でも tick 上限で必ず止まる', () => {
    const rules = {
      ...DEFAULT_RULES,
      tickLimit: 100,
      maxActivations: { ...DEFAULT_RULES.maxActivations, conveyor: null },
    };
    const result = run(['S> Cv C<', '.. C> C^'], 1, rules);
    expect(result.stats.haltedByTickLimit).toBe(true);
    expect(result.stats.ticks).toBe(100);
    expect(result.events.every((e) => e.tick <= 100)).toBe(true);
  });

  it('再起動装置どうしが互いをリセットし続けても tick 上限で止まる', () => {
    // R と R が隣接 + コンベアのループで信号が回り続ける配置
    const rules = { ...createRuleSet(), tickLimit: 200 };
    const result = run(['S> Rv C<', '.. R^ C^'], 1, rules);
    expect(result.stats.haltedByTickLimit).toBe(true);
    expect(result.stats.ticks).toBe(200);
  });

  it('ドラム缶だらけの盤面でも止まる', () => {
    const rows = Array.from({ length: 7 }, (_, y) =>
      Array.from({ length: 7 }, (_, x) => (x === 0 && y === 3 ? 'S>' : 'B^')).join(' '),
    );
    const result = run(rows);
    expect(result.stats.haltedByTickLimit).toBe(false);
  });
});
