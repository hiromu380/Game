import { describe, expect, it } from 'vitest';
import { advanceBasho, answerRetirement, createGame, migrateSave, toshiyoriProgress } from '../src';
import { emptyCareer } from '../src/career/create';

describe('番付の推移と歴代の力士', () => {
  it('自分の弟子は場所ごとの成績と番付の順位が残る（他の部屋の力士は残さない）', () => {
    let s = createGame({ seed: 8 });
    s = advanceBasho(advanceBasho(s));
    const mine = s.rikishi.filter((r) => r.stableId === s.player.stableId && r.career.basho === 2);
    expect(mine.length).toBeGreaterThan(0);
    for (const r of mine) {
      expect(r.track.map((e) => e.bashoIndex)).toEqual([0, 1]);
      expect(r.track[0]!.order).toBeGreaterThanOrEqual(0);
    }
    expect(
      s.rikishi.filter((r) => r.stableId !== s.player.stableId).every((r) => r.track.length === 0),
    ).toBe(true);
  });

  it('引退した弟子は歴代の力士に残る（経歴と推移ごと）', () => {
    let s = advanceBasho(createGame({ seed: 8 }));
    const r = s.rikishi.find((x) => x.stableId === s.player.stableId && x.career.basho > 0)!;
    s.pending.retireRequests.push(r.id);
    s = answerRetirement(s, r.id, true);
    const a = s.player.alumni.find((x) => x.id === r.id)!;
    expect(a.name).toBe(r.name);
    expect(a.track).toHaveLength(1);
    expect(a.generation).toBe(1);
  });

  it('年寄名跡の資格まであと何場所か（外国籍は null）', () => {
    const c = { ...emptyCareer(), makuuchiBasho: 12, sekitoriBasho: 25 };
    expect(toshiyoriProgress({ foreign: false, career: c })).toEqual({
      sanyaku: 1,
      makuuchi: 8,
      sekitori: 5,
    });
    expect(toshiyoriProgress({ foreign: true, career: c })).toBeNull();
  });

  it('版6のセーブを今の版に変換できる', () => {
    const s = createGame({ seed: 1 }) as unknown as Record<string, unknown>;
    const v6 = JSON.parse(JSON.stringify(s));
    v6.version = 6;
    for (const r of v6.rikishi) delete r.track;
    delete v6.player.alumni;
    const m = migrateSave(v6)!;
    expect(m.version).toBe(11);
    expect(m.player.alumni).toEqual([]);
    expect(advanceBasho(m).bashoIndex).toBe(1);
  });
});
