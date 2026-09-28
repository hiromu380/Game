/**
 * 素材（art/ の生成結果）が書き出し済みのファイルと一致すること
 * 失敗したら: pnpm --filter @chain-factory/client art
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildArt } from '../art';
import { UI_ICON_NAMES as GENERATED_UI_ICONS } from '../art/icons';
import { UI_ICON_NAMES } from '../src/assets/manifest';

describe('素材の生成', () => {
  it.each(Object.entries(buildArt()))('%s が最新', (relative, content) => {
    expect(readFileSync(join(import.meta.dirname, '..', relative), 'utf8')).toBe(content);
  });
});

describe('アセットマニフェスト', () => {
  it('UI アイコンの一覧が生成した素材と一致する', () => {
    expect([...UI_ICON_NAMES].sort()).toEqual([...GENERATED_UI_ICONS].sort());
  });
});
