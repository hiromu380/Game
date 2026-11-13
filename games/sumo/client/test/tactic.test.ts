import { describe, expect, it } from 'vitest';
import { TACTICS } from '@ichimon/sim';
import ja from '../src/i18n/ja.json';
import en from '../src/i18n/en.json';

describe('大一番の作戦（画面の文言）', () => {
  it('作戦の名前と1行の説明が日本語・英語にある', () => {
    for (const c of ['normal', ...TACTICS]) {
      for (const k of [`tactic.${c}`, `tactic.desc.${c}`]) {
        expect(ja).toHaveProperty([k]);
        expect(en).toHaveProperty([k]);
      }
    }
    for (const k of [
      'tactic.title',
      'tactic.lead',
      'tactic.vs',
      'tactic.group',
      'tactic.desc.none',
      'tactic.offStyle',
      'tactic.go',
      'ticker.toTactic',
      'bigBout.tactic',
      'rewards.henka',
    ]) {
      expect(ja).toHaveProperty([k]);
      expect(en).toHaveProperty([k]);
    }
  });
});
