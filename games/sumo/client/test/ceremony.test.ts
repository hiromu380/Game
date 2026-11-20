import { describe, expect, it } from 'vitest';
import { ranksOf, type GameState } from '@ichimon/sim';
import { escortsOf, ownYokozuna, yumitoriOf } from '../src/ceremony';
import { play } from '../../sim/test/play';

/** 自分の弟子を番付のいちばん上（横綱）とその下に並べ替えた状態 */
function withYokozuna(): { g: GameState; y: number } {
  const g: GameState = JSON.parse(JSON.stringify(play(7, 3)));
  const mine = g.rikishi.filter((r) => r.stableId === g.player.stableId).map((r) => r.id);
  const y = mine[0]!;
  g.banzuke = [y, ...g.banzuke.filter((id) => id !== y)];
  g.titles = { ...g.titles, [y]: 'Y' };
  return { g, y };
}

describe('横綱まわりの役', () => {
  it('横綱がいなければ弓取りはいない', () => {
    const g = play(7, 3);
    if (ownYokozuna(g).length === 0) expect(yumitoriOf(g)).toBeNull();
  });

  it('横綱がいれば、部屋の幕下以下のいちばん上が弓取り。太刀持ち・露払いは部屋の幕内（いなければ一門から＝null）', () => {
    const { g, y } = withYokozuna();
    expect(ranksOf(g.banzuke, g.titles).get(y)?.title).toBe('Y');
    expect(ownYokozuna(g)).toEqual([y]);
    const yumi = yumitoriOf(g);
    if (yumi !== null) {
      const k = ranksOf(g.banzuke, g.titles).get(yumi)!;
      expect(['makuuchi', 'juryo']).not.toContain(k.division);
    }
    const { tachi, tsuyu } = escortsOf(g, y);
    for (const x of [tachi, tsuyu])
      if (x !== null) expect(ranksOf(g.banzuke, g.titles).get(x)?.division).toBe('makuuchi');
    if (tachi === null) expect(tsuyu).toBeNull();
  });
});
