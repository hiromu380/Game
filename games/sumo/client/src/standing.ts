/**
 * 部屋の力の順位（全部屋の中で何位か）。番付の点の合計で並べる（sim の stableStandings）
 * 「12位／44」のように、ほかの部屋と比べて言い合える尺度にする
 */
import { stableStandings, type GameState } from '@ichimon/sim';

export function myStanding(game: GameState): { place: number; total: number; strength: number } {
  const rows = stableStandings(game);
  const me = rows.find((r) => r.stableId === game.player.stableId);
  return { place: me?.place ?? rows.length, total: rows.length, strength: me?.strength ?? 0 };
}
