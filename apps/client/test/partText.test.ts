import { DEFAULT_RULES } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { translate } from '../src/i18n';
import { describePart } from '../src/ui/partText';

const tJa = ((key: string, params?: Record<string, unknown>) =>
  translate('ja', key as never, params as never)) as never;

describe('パーツの説明文', () => {
  it('係数が 1 のときは「×1」を書かない短い文にする', () => {
    expect(describePart(tJa, 'magnet', DEFAULT_RULES)).toBe('値 ×（1＋同じ行・列の出荷口の数）');
    expect(describePart(tJa, 'press', DEFAULT_RULES)).not.toContain('×1');
  });

  it('係数が 1 でなくなったら（レリックなど）、係数入りの文に戻る', () => {
    const rules = { ...DEFAULT_RULES, params: { ...DEFAULT_RULES.params, coilPerNeighbor: 2 } };
    expect(describePart(tJa, 'coil', rules)).toContain('×2');
  });
});
