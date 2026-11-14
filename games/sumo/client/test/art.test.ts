import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { oyakataLook, rikishiLook, widthFor } from '../src/art/look';
import en from '../src/i18n/en.json';
import ja from '../src/i18n/ja.json';

const base = {
  id: 7,
  weight: 120,
  stableId: 2,
  careerBasho: 10,
  sekitori: false,
  yokozuna: false,
  injured: false,
  fatigue: 0,
};

describe('力士の見た目', () => {
  it('同じ力士はいつも同じ顔（体重や番付が変わっても目・眉・口・肌は同じ）', () => {
    const a = rikishiLook(base);
    const b = rikishiLook({ ...base, weight: 170, sekitori: true, careerBasho: 50 });
    expect([a.eyes, a.brows, a.mouth, a.skin]).toEqual([b.eyes, b.brows, b.mouth, b.skin]);
  });

  it('髪: 入門したてはざんばら → ちょんまげ → 関取は大銀杏', () => {
    expect(rikishiLook({ ...base, careerBasho: 0 }).hair).toBe('zanbara');
    expect(rikishiLook({ ...base, careerBasho: 6 }).hair).toBe('chonmage');
    expect(rikishiLook({ ...base, sekitori: true }).hair).toBe('oicho');
  });

  it('関取は締め込みと下がり、横綱は綱。重いほど体が広い（上限つき）', () => {
    const s = rikishiLook({ ...base, sekitori: true, yokozuna: true });
    expect(s.sagari && s.tsuna).toBe(true);
    expect(widthFor(180)).toBeGreaterThan(widthFor(100));
    expect(widthFor(400)).toBe(widthFor(500));
  });

  it('親方は着物。55歳から白髪', () => {
    expect(oyakataLook({ id: 1, age: 40, stableId: 1 })).toMatchObject({
      kimono: true,
      hair: 'short',
    });
    expect(oyakataLook({ id: 1, age: 60, stableId: 1 }).hair).toBe('gray');
  });
});

describe('見出しフォントの収録文字', () => {
  it('i18n の文言の字がすべて入っている（足りなければ build/subset-font.mjs を実行し直す）', () => {
    const charset = new Set(readFileSync(join(__dirname, '../build/charset.txt'), 'utf8'));
    const missing = new Set<string>();
    for (const text of [...Object.values(ja), ...Object.values(en)]) {
      for (const c of text) if (!charset.has(c) && c !== '\n') missing.add(c);
    }
    expect([...missing].join('')).toBe('');
  });
});
