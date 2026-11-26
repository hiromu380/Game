import { describe, expect, it } from 'vitest';
import { KIMARITE } from '@ichimon/sim';
import { kimariteBook, kimariteCollected } from '../src/kimariteBook';
import { play } from '../../sim/test/play';

describe('決まり手帳', () => {
  it('すべての決まり手を並べ、部屋の白星の数と最多の力士を出す', () => {
    const g = play(8, 18);
    const book = kimariteBook(g);
    expect(book.length).toBe(KIMARITE.length);
    const got = book.filter((e) => e.count > 0);
    expect(got.length).toBeGreaterThan(0);
    for (const e of got) expect(e.best!.count).toBeLessThanOrEqual(e.count);
    const c = kimariteCollected(g);
    expect(c.total).toBe(KIMARITE.filter((k) => k.group !== 'hiwaza').length);
    expect(c.got).toBeLessThanOrEqual(c.total);
  });
});
