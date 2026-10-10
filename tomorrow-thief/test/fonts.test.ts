/**
 * 同梱フォントの収録文字: 画面に出る文字がすべて入っているか（文言を変えたら scripts/fonts.mjs を実行し直す）
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error scripts は .mjs（型なし）
import { collectCharset } from '../scripts/fonts.mjs';

describe('同梱フォント', () => {
  it('src・index.html の文字がすべてサブセットに入っている', () => {
    const bundled = new Set(readFileSync(join(import.meta.dirname, '../scripts/charset.txt'), 'utf8'));
    const missing = [...(collectCharset() as string)].filter((c) => !bundled.has(c));
    expect(missing.join('')).toBe('');
  });
});
