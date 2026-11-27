/**
 * 横綱まわりの役（純粋関数。乱数を使わない。docs/rikishi-life.md）
 * - 太刀持ち・露払い: 横綱と同じ部屋の幕内力士（番付の上から。太刀持ちが上）。いなければ一門の部屋の幕内力士
 * - 弓取り: 横綱の部屋の幕下以下の弟子（けがのない、番付のいちばん上の者）。いなければ一門の部屋の力士
 */
import { ranksOf, type GameState } from '@ichimon/sim';

function ownSorted(game: GameState) {
  const ranks = ranksOf(game.banzuke, game.titles);
  const mine = new Set(
    game.rikishi.filter((r) => r.stableId === game.player.stableId).map((r) => r.id),
  );
  return { ranks, ids: game.banzuke.filter((id) => mine.has(id)) };
}

/** 自分の部屋の横綱（番付の上から） */
export function ownYokozuna(game: GameState): number[] {
  const { ranks, ids } = ownSorted(game);
  return ids.filter((id) => ranks.get(id)?.title === 'Y');
}

/** 横綱の土俵入りの太刀持ち・露払い（部屋にいなければ null＝一門から） */
export function escortsOf(
  game: GameState,
  yokozuna: number,
): { tachi: number | null; tsuyu: number | null } {
  const { ranks, ids } = ownSorted(game);
  const makuuchi = ids.filter(
    (id) =>
      id !== yokozuna && ranks.get(id)?.division === 'makuuchi' && ranks.get(id)?.title !== 'Y',
  );
  return { tachi: makuuchi[0] ?? null, tsuyu: makuuchi[1] ?? null };
}

/** 弓取り（部屋に横綱がいるときだけ。幕下以下がいなければ null） */
export function yumitoriOf(game: GameState): number | null {
  if (ownYokozuna(game).length === 0) return null;
  const { ranks, ids } = ownSorted(game);
  const lower = ids.filter((id) => {
    const k = ranks.get(id);
    const r = game.rikishi.find((x) => x.id === id)!;
    return k && k.division !== 'makuuchi' && k.division !== 'juryo' && r.injury === 0;
  });
  return lower[0] ?? null;
}
