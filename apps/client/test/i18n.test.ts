import { BALANCE, maxAscension, PART_IDS, RELIC_IDS } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import ja from '../src/i18n/ja.json';
import { translate } from '../src/i18n';

describe('i18n ファイル', () => {
  it('ja と en のキーが一致している', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ja).sort());
  });

  it('翻訳ごとのプレースホルダーが一致している', () => {
    for (const key of Object.keys(ja) as (keyof typeof ja)[]) {
      const placeholders = (message: string) =>
        [...message.matchAll(/\{(\w+)\}/g)].map(([, name]) => name).sort();
      expect(placeholders(en[key])).toEqual(placeholders(ja[key]));
    }
  });

  it('全パーツの名前と説明がある', () => {
    for (const id of PART_IDS) {
      expect(ja).toHaveProperty([`part.${id}.name`]);
      expect(ja).toHaveProperty([`part.${id}.desc`]);
    }
  });

  it('全レリックの名前と説明があり、効果量がすべて埋まる', () => {
    for (const id of RELIC_IDS) {
      expect(ja).toHaveProperty([`relic.${id}.name`]);
      for (const lang of ['ja', 'en'] as const) {
        const text = translate(lang, `relic.${id}.desc`, { ...BALANCE.relics.params });
        expect(text).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it('残業レベルの全段に名前がある', () => {
    for (let level = 1; level <= maxAscension(BALANCE); level++) {
      expect(ja).toHaveProperty([`ascension.name.${level}`]);
    }
  });
});
