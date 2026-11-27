import { describe, expect, it } from 'vitest';
import ja from '../src/i18n/ja.json';
import en from '../src/i18n/en.json';

/** 言語で書き方が違うので、差し込む値が違ってよいもの（どちらの値も渡している） */
const ALLOWED = new Set(['journal.rescue.loan']);
const params = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('文言', () => {
  it('日本語と英語で同じキーがあり、差し込む値がそろっている', () => {
    const a = ja as Record<string, string>;
    const b = en as Record<string, string>;
    expect(Object.keys(a).filter((k) => !(k in b))).toEqual([]);
    expect(Object.keys(b).filter((k) => !(k in a))).toEqual([]);
    const bad = Object.keys(a).filter(
      (k) => !ALLOWED.has(k) && params(a[k]!).join() !== params(b[k]!).join(),
    );
    expect(bad).toEqual([]);
  });
});
