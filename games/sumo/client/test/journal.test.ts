import { describe, expect, it } from 'vitest';
import { createGame, HAPPENINGS, type JournalEntry } from '@ichimon/sim';
import { makeT, type MessageKey } from '../src/i18n';
import { journalGroup, journalText } from '../src/journal';
import { parseSaveFile, saveFileText } from '../src/save';

const M1 = { division: 'makuuchi' as const, title: 'M' as const, number: 1, side: 'E' as const };

const SAMPLES: JournalEntry[] = [
  { bashoIndex: 0, kind: 'earlier' },
  { bashoIndex: 0, kind: 'open', stable: '白浦', shikona: '白山' },
  { bashoIndex: 1, kind: 'join', shikona: '白ノ海', age: 15 },
  { bashoIndex: 2, kind: 'promote', shikona: '白ノ海', stable: '白浦', to: 'Y' },
  {
    bashoIndex: 2,
    kind: 'yusho',
    shikona: '白ノ海',
    stable: '白浦',
    division: 'makuuchi',
    wins: 14,
  },
  { bashoIndex: 2, kind: 'sansho', shikona: '白ノ海', prize: 'kanto' },
  { bashoIndex: 3, kind: 'retire', shikona: '白ノ海', age: 33, highest: M1, oyakata: '浦風' },
  { bashoIndex: 3, kind: 'retire', shikona: '白岩', age: 30, highest: null, oyakata: null },
  { bashoIndex: 3, kind: 'retire', shikona: '白岩', age: 30, highest: M1, oyakata: '' },
  ...HAPPENINGS.flatMap((h) =>
    h.options.map((o): JournalEntry => ({
      bashoIndex: 4,
      kind: 'happening',
      id: h.id,
      option: o.key,
    })),
  ),
  { bashoIndex: 5, kind: 'independence', stable: '浦風', shikona: '白ノ海' },
  { bashoIndex: 5, kind: 'successor', generation: 2, stable: '白浦', shikona: '白岩' },
  { bashoIndex: 5, kind: 'kakun', id: 'chanko' },
  { bashoIndex: 5, kind: 'facility', id: 'dorm', level: 2 },
  { bashoIndex: 6, kind: 'branchSucceeded', stable: '浦風', shikona: '白岩' },
  { bashoIndex: 6, kind: 'branchClosed', stable: '浦風' },
  { bashoIndex: 7, kind: 'diet', diet: 'hearty' },
  { bashoIndex: 9, kind: 'office', rank: 'iin' },
  ...(['elected', 'lost', 'stayed'] as const).flatMap((result) =>
    [true, false].map((rebel): JournalEntry => ({
      bashoIndex: 9,
      kind: 'election',
      result,
      rank: 'riji',
      rebel,
      uncontested: !rebel,
    })),
  ),
  ...(['new', 'yusho', 'O', 'Y', 'signed'] as const).map((event): JournalEntry => ({
    bashoIndex: 8,
    kind: 'rival',
    event,
    stable: '浦風',
    shikona: '白鵬丸',
  })),
  { bashoIndex: 7, kind: 'staffHire', role: 'wakaimonogashira', name: '白岩' },
  { bashoIndex: 7, kind: 'staffLeave', role: 'sewanin', name: '白岩', retired: true },
  { bashoIndex: 7, kind: 'staffLeave', role: 'sewanin', name: '白岩', retired: false },
];

describe('出来事の文言', () => {
  it('すべての出来事に題・本文・選択肢と説明があり、確率の選択肢には結果の文がある（どちらの言語でも）', () => {
    for (const lang of ['ja', 'en'] as const) {
      const t = makeT(lang);
      const has = (key: string) => {
        const text = t(key as MessageKey, { name: '白山', rival: '浦風' });
        expect(text, key).not.toBe(key);
        expect(text, key).not.toMatch(/\{/);
      };
      for (const h of HAPPENINGS) {
        has(`happening.${h.id}.title`);
        has(`happening.${h.id}.body`);
        for (const o of h.options) {
          has(`happening.${h.id}.${o.key}`);
          has(`happening.${h.id}.${o.key}.desc`);
          if (o.chance) {
            has(`happening.${h.id}.${o.key}.hit`);
            has(`happening.${h.id}.${o.key}.miss`);
          }
        }
      }
    }
  });
});

describe('部屋の日誌の文', () => {
  it('すべての種類が、どちらの言語でも文になる（鍵がそのまま出ない）', () => {
    for (const lang of ['ja', 'en'] as const) {
      const t = makeT(lang);
      for (const e of SAMPLES) {
        const text = journalText(t, e);
        expect(text).not.toMatch(/journal\.|happening\.|\{/);
        expect(text.length).toBeGreaterThan(3);
      }
    }
  });

  it('文の例と分類', () => {
    const t = makeT('ja');
    expect(journalText(t, SAMPLES[6]!)).toBe(
      '白ノ海が33歳で引退（最高位 前頭1枚目）。年寄 浦風を襲名し、親方として残る。',
    );
    expect(journalGroup(SAMPLES[3]!)).toBe('stable');
    expect(journalGroup(SAMPLES[1]!)).toBe('lineage');
    expect(journalGroup(SAMPLES[0]!)).toBeNull();
  });
});

describe('セーブのファイル', () => {
  it('書き出したものを読み込むと同じ状態に戻る', () => {
    const g = createGame({ seed: 8 });
    expect(parseSaveFile(saveFileText(g))).toEqual(g);
  });

  it('古い版は今の版に変換して読む', () => {
    const g = JSON.parse(saveFileText(createGame({ seed: 8 })));
    g.version = 9;
    delete g.journal;
    expect(parseSaveFile(JSON.stringify(g))?.journal[0]).toEqual({
      bashoIndex: 0,
      kind: 'earlier',
    });
  });

  it('一門のセーブでないもの・壊れたものは読まない', () => {
    expect(parseSaveFile('not json')).toBeNull();
    expect(parseSaveFile('{"version": 10}')).toBeNull();
    expect(parseSaveFile('[]')).toBeNull();
    const g = JSON.parse(saveFileText(createGame({ seed: 8 })));
    g.player.stableId = -1;
    expect(parseSaveFile(JSON.stringify(g))).toBeNull();
  });
});
