import { describe, expect, it } from 'vitest';
import { KIMARITE } from '@ichimon/sim';
import { KIMARITE_DESC, kimariteBook, kimariteCollected } from '../src/kimariteBook';
import ja from '../src/i18n/ja.json';
import en from '../src/i18n/en.json';
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

describe('決まり手の説明', () => {
  it('説明のある決まり手の一覧と文言がそろっている（日英）', () => {
    const ids = new Set(KIMARITE.map((k) => k.id));
    for (const id of KIMARITE_DESC) {
      expect(ids.has(id)).toBe(true);
      expect(ja).toHaveProperty([`kimarite.desc.${id}`]);
      expect(en).toHaveProperty([`kimarite.desc.${id}`]);
    }
    const keys = Object.keys(ja).filter((k) => k.startsWith('kimarite.desc.'));
    expect(keys.length).toBe(KIMARITE_DESC.size);
  });
});
