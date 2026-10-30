import { describe, expect, it } from 'vitest';
import { advanceBasho, createGame, isSekitori, migrateSave, ranksOf } from '../src';

describe('一年の行事', () => {
  it('春場所の後は春巡業（初場所の後はなし）', () => {
    let s = createGame({ seed: 4 });
    s = advanceBasho(s); // 初場所
    expect(s.lastReport!.jungyo).toBeNull();
    s = advanceBasho(s); // 春場所
    expect(s.lastReport!.jungyo).toBe('spring');
  });

  it('番付発表: 自分の弟子のこの場所の地位と次の地位', () => {
    const s = advanceBasho(createGame({ seed: 4 }));
    const ranks = ranksOf(s.banzuke, s.titles);
    expect(s.lastReport!.banzukeChanges.length).toBe(s.lastReport!.mine.length);
    for (const c of s.lastReport!.banzukeChanges) {
      if (c.to) expect(ranks.get(c.id)).toEqual(c.to);
    }
  });

  it('巡業に出るのは関取だけ（幕下以下の疲れは稽古の分だけ）', () => {
    const s = advanceBasho(advanceBasho(createGame({ seed: 6 })));
    const ranks = ranksOf(s.banzuke, s.titles);
    const sekitori = s.rikishi.filter((r) => ranks.get(r.id) && isSekitori(ranks.get(r.id)!));
    expect(sekitori.length).toBe(70);
  });

  it('版3のセーブの直近の結果に、番付の上がり下がりと巡業を足す', () => {
    const s = advanceBasho(createGame({ seed: 2 })) as unknown as Record<string, unknown>;
    const v3 = JSON.parse(JSON.stringify(s));
    v3.version = 3;
    delete v3.lastReport.banzukeChanges;
    delete v3.lastReport.jungyo;
    const m = migrateSave(v3)!;
    expect(m.version).toBe(7);
    expect(m.lastReport!.banzukeChanges).toEqual([]);
    expect(m.lastReport!.jungyo).toBeNull();
  });
});
