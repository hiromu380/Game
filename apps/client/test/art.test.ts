/**
 * 素材（art/ の生成結果）が書き出し済みのファイルと一致すること
 * 失敗したら: pnpm --filter @chain-factory/client art
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildArt } from '../art';
import { ACHIEVEMENT_IDS, BOSS_MODIFIERS, PART_IDS } from '@chain-factory/sim';
import { ACHIEVEMENT_ICON_IDS } from '../art/achievements';
import { UI_ICON_NAMES as GENERATED_UI_ICONS } from '../art/icons';
import { LETTERING_CHARS } from '../art/lettering';
import {
  ACHIEVEMENT_ICONS,
  BOARD_ASSETS,
  BOSS_ICONS,
  LOGO_ASSETS,
  MASCOT_ASSETS,
  PART_ASSETS,
  ROCKET_ASSETS,
  TITLE_ASSETS,
  UI_ICONS,
  UI_ICON_NAMES,
} from '../src/assets/manifest';

const normalizeLineEndings = (value: string) => value.replace(/\r\n/g, '\n');

describe('素材の生成', () => {
  it.each(Object.entries(buildArt()))('%s が最新', (relative, content) => {
    expect(
      normalizeLineEndings(readFileSync(join(import.meta.dirname, '..', relative), 'utf8')),
    ).toBe(normalizeLineEndings(content));
  });
});

describe('アセットマニフェスト', () => {
  it('全パーツ・ボス・実績に存在する画像が割り当てられている', () => {
    expect(Object.keys(PART_ASSETS).sort()).toEqual([...PART_IDS].sort());
    expect(Object.keys(BOSS_ICONS).sort()).toEqual(Object.keys(BOSS_MODIFIERS).sort());
    expect(Object.keys(ACHIEVEMENT_ICONS).sort()).toEqual([...ACHIEVEMENT_IDS].sort());

    for (const asset of Object.values(PART_ASSETS)) expect(asset.src).toBeTruthy();
    for (const assets of [BOSS_ICONS, ACHIEVEMENT_ICONS]) {
      for (const src of Object.values(assets)) expect(src).toBeTruthy();
    }
  });

  it('共通素材と段階素材がすべて読み込まれている', () => {
    const singleAssets = [
      ...Object.values(MASCOT_ASSETS),
      ...BOARD_ASSETS.floors,
      BOARD_ASSETS.blocked,
      BOARD_ASSETS.frameCorner,
      BOARD_ASSETS.frameEdge,
      BOARD_ASSETS.background,
      ...Object.values(LOGO_ASSETS),
      ...Object.values(TITLE_ASSETS),
      ...Object.values(UI_ICONS),
      ROCKET_ASSETS.flame,
    ];
    expect(BOARD_ASSETS.floors).toHaveLength(3);
    expect(ROCKET_ASSETS.stages.length).toBeGreaterThan(1);
    expect(singleAssets.every(Boolean)).toBe(true);
    expect(ROCKET_ASSETS.stages.every(Boolean)).toBe(true);
  });

  it('すべての実績にアイコンがある', () => {
    expect([...ACHIEVEMENT_ICON_IDS].sort()).toEqual([...ACHIEVEMENT_IDS].sort());
  });

  it('ロゴの文字がそろっている', () => {
    for (const c of 'CHAINFACTORY') expect(LETTERING_CHARS).toContain(c);
  });

  it('UI アイコンの一覧が生成した素材と一致する', () => {
    expect([...UI_ICON_NAMES].sort()).toEqual([...GENERATED_UI_ICONS].sort());
  });
});
