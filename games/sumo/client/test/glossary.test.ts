import { describe, expect, it } from 'vitest';
import { createGame } from '@ichimon/sim';
import { GLOSSARY_GROUPS, seenTerms, TERMS } from '../src/glossary';
import ja from '../src/i18n/ja.json';
import en from '../src/i18n/en.json';
import { play } from '../../sim/test/play';

describe('相撲の手帖', () => {
  it('すべての言葉に名前と説明（日英）があり、IDは重ならない。どの分類にも言葉がある', () => {
    const ids = TERMS.map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids)
      for (const dict of [ja, en] as Record<string, string>[]) {
        expect(dict[`glossary.term.${id}.name`]).toBeTruthy();
        expect(dict[`glossary.term.${id}.desc`]).toBeTruthy();
      }
    for (const g of GLOSSARY_GROUPS) expect(TERMS.some((x) => x.group === g)).toBe(true);
  });

  it('始めたばかりは暮らしの言葉だけ。場所を重ねると増え、入門・関取の言葉に出会う', () => {
    const first = seenTerms(createGame({ seed: 3 }));
    expect(first.has('chanko')).toBe(true);
    expect(first.has('maezumo')).toBe(false);
    expect(first.has('kachikoshi')).toBe(false);
    const later = seenTerms(play(3, 18));
    expect(later.has('kachikoshi')).toBe(true);
    expect(later.size).toBeGreaterThan(first.size);
    for (const id of first) expect(later.has(id)).toBe(true);
  });
});
