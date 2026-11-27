import { describe, expect, it } from 'vitest';
import { createGame, giveKojo } from '../src';

describe('昇進伝達式の口上', () => {
  const setup = (title: 'O' | 'Y' | null) => {
    const s = createGame({ seed: 4 });
    const r = s.rikishi.find((x) => x.stableId === s.player.stableId)!;
    if (title) s.titles[r.id] = title;
    return { s, r };
  };

  it('大関: 四字熟語を選ぶと本人に残り、日誌に書かれる', () => {
    const { s, r } = setup('O');
    const next = giveKojo(s, r.id, 'fudoFukutsu');
    expect(next.rikishi.find((x) => x.id === r.id)!.kojo).toBe('fudoFukutsu');
    expect(next.journal.at(-1)).toEqual({
      bashoIndex: s.bashoIndex,
      kind: 'kojo',
      shikona: r.name,
      to: 'O',
      word: 'fudoFukutsu',
    });
  });

  it('横綱は土俵入りの型も選ぶ（選ばなければ受け付けない）', () => {
    const { s, r } = setup('Y');
    expect(giveKojo(s, r.id, 'fushakuShinmyo')).toBe(s);
    const next = giveKojo(s, r.id, 'fushakuShinmyo', 'shiranui');
    expect(next.rikishi.find((x) => x.id === r.id)!.dohyoiri).toBe('shiranui');
  });

  it('大関・横綱でない弟子・ほかの部屋の力士は受け付けない', () => {
    const { s, r } = setup(null);
    expect(giveKojo(s, r.id, 'fudoFukutsu')).toBe(s);
    const other = s.rikishi.find((x) => x.stableId !== s.player.stableId)!;
    s.titles[other.id] = 'O';
    expect(giveKojo(s, other.id, 'fudoFukutsu')).toBe(s);
  });
});
