import { describe, expect, it } from 'vitest';
import { countUpValue, easeOutExpo } from '../src/ui/useCountUp';

describe('数字のカウントアップ', () => {
  it('最初は速く増え、最後は目標でピタッと止まる', () => {
    expect(easeOutExpo(0)).toBe(0);
    expect(easeOutExpo(0.2)).toBeGreaterThan(0.7);
    expect(easeOutExpo(1)).toBe(1);
    expect(countUpValue(0n, 1000n, 1)).toBe(1000n);
    expect(countUpValue(0n, 1000n, 0)).toBe(0n);
  });

  it('桁の大きな数でも途中の値が from と to のあいだに入る', () => {
    const to = 10n ** 40n;
    const mid = countUpValue(0n, to, 0.3);
    expect(mid > 0n && mid < to).toBe(true);
  });
});
