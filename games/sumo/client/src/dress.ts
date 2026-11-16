/**
 * 番付で許される身なり（docs/rikishi-life.md「番付で変わること」。解説サイトで細部に食い違いがあるので、広く言われていることだけ）
 * 0: 序ノ口・序二段 / 1: 三段目 / 2: 幕下 / 3: 十両 / 4: 幕内
 */
import type { Division, Rank } from '@ichimon/sim';

export type DressLevel = 0 | 1 | 2 | 3 | 4;

const LEVEL: Record<Division, DressLevel> = {
  jonokuchi: 0,
  jonidan: 0,
  sandanme: 1,
  makushita: 2,
  juryo: 3,
  makuuchi: 4,
};

/** 次の身なりが許される段 */
const NEXT: Record<DressLevel, Division | null> = {
  0: 'sandanme',
  1: 'makushita',
  2: 'juryo',
  3: 'makuuchi',
  4: null,
};

export function dressLevel(rank: Rank | null): DressLevel {
  return rank ? LEVEL[rank.division] : 0;
}

export function nextDress(level: DressLevel): { division: Division; level: DressLevel } | null {
  const d = NEXT[level];
  return d ? { division: d, level: (level + 1) as DressLevel } : null;
}

/** 手帖の補足に並べる順（その身なりが許される最初の段） */
export const DRESS_STEPS: readonly { level: DressLevel; division: Division }[] = [
  { level: 0, division: 'jonokuchi' },
  { level: 1, division: 'sandanme' },
  { level: 2, division: 'makushita' },
  { level: 3, division: 'juryo' },
  { level: 4, division: 'makuuchi' },
];
