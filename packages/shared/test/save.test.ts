import { createRun } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { createSave, migrateSave, SAVE_VERSION } from '../src';

describe('セーブデータ', () => {
  it('バージョン番号を持ち、JSON を往復しても同じ内容になる', () => {
    const save = createSave(createRun(42));
    expect(save.version).toBe(SAVE_VERSION);
    expect(migrateSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });

  it('未知のバージョンや壊れたデータは null', () => {
    expect(migrateSave({ version: 999 })).toBeNull();
    expect(migrateSave('broken')).toBeNull();
    expect(migrateSave(null)).toBeNull();
  });
});
