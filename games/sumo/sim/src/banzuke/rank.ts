/**
 * 番付の並び（上から順の力士 ID）と、地位（段・枚目・東西）の対応
 */
import { DIVISION_SIZE, DIVISIONS, JONOKUCHI_SHARE } from '../balance/banzuke';
import type { Division, Rank, Title } from '../model/types';

/** 段ごとの人数（全体の人数から決まる） */
export function divisionCounts(total: number): Record<Division, number> {
  const fixed =
    DIVISION_SIZE.makuuchi + DIVISION_SIZE.juryo + DIVISION_SIZE.makushita + DIVISION_SIZE.sandanme;
  const rest = Math.max(0, total - fixed);
  const jonokuchi = Math.min(
    rest,
    Math.max(
      JONOKUCHI_SHARE.min,
      Math.min(JONOKUCHI_SHARE.max, Math.round(rest * JONOKUCHI_SHARE.ratio)),
    ),
  );
  // 人数が足りないときは上の段から埋める
  let left = total;
  const take = (n: number) => {
    const v = Math.min(n, left);
    left -= v;
    return v;
  };
  return {
    makuuchi: take(DIVISION_SIZE.makuuchi),
    juryo: take(DIVISION_SIZE.juryo),
    makushita: take(DIVISION_SIZE.makushita),
    sandanme: take(DIVISION_SIZE.sandanme),
    jonidan: take(rest - jonokuchi),
    jonokuchi: take(jonokuchi),
  };
}

const TITLE_ORDER: Title[] = ['Y', 'O', 'S', 'K', 'M'];

/** 番付の並びから、力士 ID → 地位 を作る */
export function ranksOf(
  banzuke: readonly number[],
  titles: Record<number, Title>,
): Map<number, Rank> {
  const counts = divisionCounts(banzuke.length);
  const result = new Map<number, Rank>();
  let index = 0;
  for (const division of DIVISIONS) {
    const ids = banzuke.slice(index, index + counts[division]);
    index += counts[division];
    if (division === 'makuuchi') {
      // 地位ごとに東西の順で 1 枚目から数える
      for (const title of TITLE_ORDER) {
        const group = ids.filter((id) => (titles[id] ?? 'M') === title);
        group.forEach((id, i) => {
          result.set(id, {
            division,
            title,
            number: Math.floor(i / 2) + 1,
            side: i % 2 === 0 ? 'E' : 'W',
          });
        });
      }
    } else {
      ids.forEach((id, i) => {
        result.set(id, {
          division,
          title: null,
          number: Math.floor(i / 2) + 1,
          side: i % 2 === 0 ? 'E' : 'W',
        });
      });
    }
  }
  return result;
}

export function isSekitori(rank: Rank): boolean {
  return rank.division === 'makuuchi' || rank.division === 'juryo';
}

export function isSanyaku(rank: Rank): boolean {
  return rank.title === 'Y' || rank.title === 'O' || rank.title === 'S' || rank.title === 'K';
}

/** 地位の短い表記（例: 東前頭3枚目 → 「前3東」に近い形のキー）。画面の文言は i18n で作る */
export function rankKey(rank: Rank): string {
  return `${rank.title ?? rank.division}-${rank.number}-${rank.side}`;
}

const DIVISION_ORDER: Record<Rank['division'], number> = {
  makuuchi: 0,
  juryo: 1,
  makushita: 2,
  sandanme: 3,
  jonidan: 4,
  jonokuchi: 5,
};
const TITLE_VALUE: Record<Title, number> = { Y: 0, O: 1, S: 2, K: 3, M: 4 };

/** 地位の高さ（小さいほど上。比べるためだけの値） */
export function rankValue(rank: Rank): number {
  return (
    DIVISION_ORDER[rank.division] * 10000 +
    (rank.title ? TITLE_VALUE[rank.title] * 1000 : 0) +
    rank.number * 2 +
    (rank.side === 'W' ? 1 : 0)
  );
}
