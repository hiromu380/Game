import { describe, expect, it } from 'vitest';
import type { Division } from '@ichimon/sim';
import { dressLevel, nextDress } from '../src/dress';
import ja from '../src/i18n/ja.json';

const rank = (division: Division) => ({ division, title: null, number: 1, side: 'E' as const });

describe('番付で許される身なり', () => {
  it('段が上がるほど許される物が増え、幕内で終わる。前相撲は序ノ口と同じ', () => {
    expect(dressLevel(null)).toBe(0);
    expect(dressLevel(rank('jonidan'))).toBe(0);
    expect(dressLevel(rank('sandanme'))).toBe(1);
    expect(dressLevel(rank('makushita'))).toBe(2);
    expect(dressLevel(rank('juryo'))).toBe(3);
    expect(dressLevel(rank('makuuchi'))).toBe(4);
    expect(nextDress(0)).toEqual({ division: 'sandanme', level: 1 });
    expect(nextDress(4)).toBeNull();
    for (const l of [0, 1, 2, 3, 4])
      expect((ja as Record<string, string>)[`dress.level.${l}`]).toBeTruthy();
  });
});
