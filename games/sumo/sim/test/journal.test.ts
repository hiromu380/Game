import { describe, expect, it } from 'vitest';
import {
  acceptCandidate,
  advanceBasho,
  answerHappening,
  buildFacility,
  createGame,
  migrateSave,
  type JournalEntry,
} from '../src';
import { play } from './play';

describe('部屋の日誌', () => {
  it('部屋を開いたことから始まる', () => {
    const s = createGame({ seed: 1 });
    const stable = s.stables.find((x) => x.isPlayer)!;
    expect(s.journal).toEqual([
      { bashoIndex: 0, kind: 'open', stable: stable.name, shikona: expect.any(String) },
    ]);
  });

  it('入門・出来事への返事・設備を書き残す（元の状態は変えない）', () => {
    let s = createGame({ seed: 2 });
    while (s.pending.candidates.length === 0) s = advanceBasho(s);
    const at = s.bashoIndex;
    const c = s.pending.candidates[0]!;
    const joined = acceptCandidate(s, c.id);
    expect(joined.journal.at(-1)).toEqual({
      bashoIndex: at,
      kind: 'join',
      shikona: c.name,
      age: c.age,
    });
    expect(joined.journal).toHaveLength(s.journal.length + 1);

    joined.pending.happening = { id: 'supporterParty', target: null };
    expect(answerHappening(joined, 1).journal.at(-1)).toMatchObject({
      kind: 'happening',
      id: 'supporterParty',
      option: 'masterOnly',
    });

    joined.player.stableMoney = 1e9;
    expect(buildFacility(joined, 'dojo').journal.at(-1)).toMatchObject({
      kind: 'facility',
      id: 'dojo',
      level: 1,
    });
  });

  it('長く遊ぶと、昇進・引退・継承が時系列で並ぶ', () => {
    const s = play(3, 180);
    const kinds = new Set(s.journal.map((e) => e.kind));
    for (const k of ['open', 'join', 'promote', 'retire', 'successor']) expect(kinds).toContain(k);
    for (let i = 1; i < s.journal.length; i++)
      expect(s.journal[i]!.bashoIndex).toBeGreaterThanOrEqual(s.journal[i - 1]!.bashoIndex);
  }, 60_000);

  it('版9のセーブは、歴代の師匠と引退した弟子から日誌を作り直す', () => {
    const s = play(5, 40);
    const v9 = JSON.parse(JSON.stringify(s));
    v9.version = 9;
    delete v9.journal;
    const m = migrateSave(v9)!;
    expect(m.version).toBe(10);
    expect(m.journal[0]).toEqual({ bashoIndex: 0, kind: 'earlier' });
    expect(m.journal[1]).toMatchObject({ kind: 'open' });
    const retired = m.journal.filter(
      (e): e is Extract<JournalEntry, { kind: 'retire' }> => e.kind === 'retire',
    );
    expect(retired).toHaveLength(m.player.alumni.length);
  });
});
