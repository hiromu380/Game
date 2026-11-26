/**
 * 決まり手帳: 部屋の弟子・元弟子が白星を挙げた決まり手を集める（協会の82手と非技5つ）
 * 力士ごとの決まり手の白星（career.kimarite）から数える純粋関数。セーブに持たない
 */
import { KIMARITE, type GameState, type KimariteGroup } from '@ichimon/sim';
import { stablePeople } from './records';

export interface KimariteEntry {
  id: string;
  group: KimariteGroup;
  /** 部屋全体の白星の数（0 はまだ） */
  count: number;
  /** いちばん多く決めた力士（いなければ null） */
  best: { name: string; count: number } | null;
}

export function kimariteBook(game: GameState): KimariteEntry[] {
  const people = stablePeople(game);
  return KIMARITE.map((k) => {
    let count = 0;
    let best: KimariteEntry['best'] = null;
    for (const p of people) {
      const n = p.career.kimarite?.[k.id] ?? 0;
      count += n;
      if (n > 0 && (!best || n > best.count)) best = { name: p.name, count: n };
    }
    return { id: k.id, group: k.group, count, best };
  });
}

/** 集めた決まり手の種類の数（非技は技ではないので数えない） */
export function kimariteCollected(game: GameState): { got: number; total: number } {
  const book = kimariteBook(game).filter((e) => e.group !== 'hiwaza');
  return { got: book.filter((e) => e.count > 0).length, total: book.length };
}
