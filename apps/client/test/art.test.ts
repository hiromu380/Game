/**
 * 素材（art/ の生成結果）が書き出し済みのファイルと一致すること
 * 失敗したら: pnpm --filter @chain-factory/client art
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildArt } from '../art';

describe('素材の生成', () => {
  it.each(Object.entries(buildArt()))('%s が最新', (relative, content) => {
    expect(readFileSync(join(import.meta.dirname, '..', relative), 'utf8')).toBe(content);
  });
});
