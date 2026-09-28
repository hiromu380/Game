/**
 * 同梱フォント: i18n の文言で使う文字がすべてサブセットに入っていること
 * 失敗したら: node tools/fonts/subset.mjs（fonttools が必要。tools/fonts/README.md）
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import ja from '../src/i18n/ja.json';

describe('同梱フォントの収録文字', () => {
  it('i18n の文字がすべて入っている', () => {
    const charset = new Set(
      readFileSync(join(import.meta.dirname, '../../../tools/fonts/charset.txt'), 'utf8'),
    );
    const missing = new Set<string>();
    for (const text of [...Object.values(ja), ...Object.values(en)]) {
      for (const c of text) if (c !== '\n' && !charset.has(c)) missing.add(c);
    }
    expect([...missing].join('')).toBe('');
  });
});
