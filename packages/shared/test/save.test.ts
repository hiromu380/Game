import { buildRunConfig, createInitialMeta, createRun, seeds } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { convertV1toV2, createSave, migrateSave, SAVE_VERSION, type SaveDataV1 } from '../src';

/** フェーズ1で実際に保存されていた形の v1 データ */
const V1_SAVE: SaveDataV1 = {
  version: 1,
  run: {
    seed: 42,
    shiftIndex: 1,
    phase: 'building',
    budget: 7,
    board: {
      width: 2,
      height: 1,
      cells: [
        { id: 'switch', dir: 1 },
        { id: 'dock', dir: 1 },
      ],
    },
    inventory: { gear: 1 },
    shop: [{ partId: 'gear', price: 4, sold: false }],
    history: [{ shiftIndex: 0, score: '8', quota: 5, cleared: true, chainCount: 4 }],
  },
};

describe('セーブデータ', () => {
  it('最新バージョン（v2）で保存し、JSON を往復しても同じ内容になる', () => {
    const save = createSave(createRun(42));
    expect(save.version).toBe(SAVE_VERSION);
    expect(SAVE_VERSION).toBe(2);
    expect(migrateSave(JSON.parse(JSON.stringify(save)))).toEqual(save);
  });

  it('未知のバージョンや壊れたデータは null', () => {
    expect(migrateSave({ version: 999 })).toBeNull();
    expect(migrateSave('broken')).toBeNull();
    expect(migrateSave(null)).toBeNull();
  });
});

describe('v1 → v2 の変換', () => {
  it('ランの盤面・予算・手持ち・履歴を引き継ぎ、RunConfig とメタ進行を補う', () => {
    const v2 = migrateSave(JSON.parse(JSON.stringify(V1_SAVE)))!;
    expect(v2.version).toBe(2);
    expect(v2.meta).toEqual(createInitialMeta());

    const run = v2.run!;
    expect(run.seed).toBe(42);
    expect(run.shiftIndex).toBe(1);
    expect(run.budget).toBe(7);
    expect(run.board).toEqual(V1_SAVE.run!.board);
    expect(run.inventory).toEqual({ gear: 1 });
    expect(run.config).toEqual(buildRunConfig({ bossSeed: seeds.bossSeed(42) }));
    expect(run.rerollCount).toBe(0);
    expect(run.trialCount).toBe(0);
    expect(run.history).toEqual([
      { shiftIndex: 0, score: '8', quota: 5, cleared: true, chainCount: 4, income: 0, boss: null },
    ]);
  });

  it('ランのない v1 も変換できる', () => {
    expect(convertV1toV2({ version: 1, run: null })).toEqual({
      version: 2,
      run: null,
      meta: createInitialMeta(),
    });
  });
});

describe('v2 の項目追加への対応', () => {
  it('後から増えた記録項目がない v2 データも読み込める', () => {
    const save = createSave(createRun(1));
    const old = JSON.parse(JSON.stringify(save));
    delete old.meta.records.bestShiftScore;
    expect(migrateSave(old)?.meta.records.bestShiftScore).toBe('0');
  });
});

describe('延長戦の項目追加への対応', () => {
  it('延長戦の項目がない v2 のランも読み込める', () => {
    const old = JSON.parse(JSON.stringify(createSave(createRun(1))));
    delete old.run.overtime;
    delete old.run.metaRecordedShifts;
    delete old.run.config.baseShiftCount;
    delete old.run.config.overtime;
    const run = migrateSave(old)!.run!;
    expect(run.overtime).toBe(false);
    expect(run.metaRecordedShifts).toBe(0);
    expect(run.config.baseShiftCount).toBe(run.config.shifts.length);
    expect(run.config.overtime).toEqual(createRun(1).config.overtime);
  });
});
