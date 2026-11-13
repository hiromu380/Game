import { describe, expect, it } from 'vitest';
import { createGame, doPrep } from '@ichimon/sim';
import { makeT } from '../src/i18n';
import { weekLine } from '../src/ui/PrepPanel';
import ja from '../src/i18n/ja.json';
import en from '../src/i18n/en.json';

describe('場所前の4週間（画面の文言）', () => {
  const t = makeT('ja');

  it('コマンドと、相手を選ぶ見出しが日本語・英語にある', () => {
    for (const k of ['coach', 'spar', 'mune', 'degeiko', 'rest', 'visit', 'scout', 'usual']) {
      expect(ja).toHaveProperty([`prep.cmd.${k}`]);
      expect(en).toHaveProperty([`prep.cmd.${k}`]);
    }
    // 指しているコマンドの1行の説明（説明を隠していても出す）
    for (const k of [
      'none',
      'coach',
      'spar',
      'mune',
      'degeiko',
      'rest',
      'visit',
      'scout',
      'usual',
    ]) {
      expect(ja).toHaveProperty([`prep.desc.${k}`]);
      expect(en).toHaveProperty([`prep.desc.${k}`]);
    }
    for (const k of ['coach', 'spar', 'mune', 'visit', 'scout']) {
      expect(ja).toHaveProperty([`prep.pick.${k}`]);
      expect(en).toHaveProperty([`prep.pick.${k}`]);
    }
  });

  it('週の結果を1行にする: だれの何がどれだけ動いたか', () => {
    const s = createGame({ seed: 5 });
    const mine = s.rikishi.filter((r) => r.stableId === s.player.stableId);
    for (const r of mine) {
      r.injury = 0;
      r.policy = 'oshi';
    }
    const coached = doPrep(s, { kind: 'coach', id: mine[0]!.id });
    const line = weekLine(t, coached, coached.prep.log[0]!);
    expect(line).toContain(mine[0]!.name);
    expect(line).toContain('押し+');
    expect(line).toContain('疲れ+');
    const rested = doPrep(s, { kind: 'rest' });
    expect(weekLine(t, rested, rested.prep.log[0]!)).toBe(t('prep.log.rest'));
    const sparred = doPrep(s, { kind: 'spar', a: mine[0]!.id, b: mine[1]!.id });
    const both = weekLine(t, sparred, sparred.prep.log[0]!);
    expect(both).toContain(mine[0]!.name);
    expect(both).toContain(mine[1]!.name);
  });
});
