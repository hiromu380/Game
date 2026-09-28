import { PART_IDS } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en.json';
import ja from '../src/i18n/ja.json';

describe('i18n ファイル', () => {
  it('ja と en のキーが一致している', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(ja).sort());
  });

  it('全パーツの名前と説明がある', () => {
    for (const id of PART_IDS) {
      expect(ja).toHaveProperty([`part.${id}.name`]);
      expect(ja).toHaveProperty([`part.${id}.desc`]);
    }
  });
});
