/**
 * 部屋の歩み: 一門が越えてきた節目と、次の目標（元弟子と今の弟子の歩みから数える。純粋関数）
 * 状態は持たない。いつ見ても、セーブの中身から同じ答えになる
 */
import type { Career, GameState } from '@ichimon/sim';
import { stablePeople } from './records';

export const GOAL_IDS = [
  'sandanme',
  'makushita',
  'sekitori',
  'makuuchi',
  'sanyaku',
  'sekitori3',
  'yusho',
  'ozeki',
  'yokozuna',
  'succession',
] as const;
export type GoalId = (typeof GOAL_IDS)[number];

export interface Goal {
  id: GoalId;
  done: boolean;
  /** 数で進む節目の、今の数と要る数 */
  progress?: { now: number; of: number };
}

/** 関取を何人育てれば節目か */
export const GOAL_SEKITORI = 3;

/** 最高位が、その段より上か同じか */
function reached(c: Career, division: 'sandanme' | 'makushita' | 'juryo' | 'makuuchi'): boolean {
  const order = ['makuuchi', 'juryo', 'makushita', 'sandanme', 'jonidan', 'jonokuchi'];
  const top = c.highestRank;
  return top !== null && order.indexOf(top.division) <= order.indexOf(division);
}

export function goalsOf(game: GameState): Goal[] {
  const careers = stablePeople(game).map((p) => p.career);
  const any = (f: (c: Career) => boolean) => careers.some(f);
  const title = (c: Career) => c.highestRank?.title ?? null;
  const sekitori = careers.filter((c) => c.sekitoriBasho > 0 || reached(c, 'juryo')).length;
  const done: Record<GoalId, boolean> = {
    sandanme: any((c) => reached(c, 'sandanme')),
    makushita: any((c) => reached(c, 'makushita')),
    sekitori: sekitori >= 1,
    makuuchi: any((c) => reached(c, 'makuuchi')),
    sanyaku: any((c) => title(c) !== null && title(c) !== 'M'),
    sekitori3: sekitori >= GOAL_SEKITORI,
    yusho: any((c) => c.makuuchiYusho > 0),
    ozeki: any((c) => title(c) === 'O' || title(c) === 'Y'),
    yokozuna: any((c) => title(c) === 'Y'),
    succession: game.player.generation >= 2,
  };
  return GOAL_IDS.map((id) => ({
    id,
    done: done[id],
    ...(id === 'sekitori3'
      ? { progress: { now: Math.min(sekitori, GOAL_SEKITORI), of: GOAL_SEKITORI } }
      : {}),
  }));
}

/** 次の目標（まだの節目のうち最初のもの。すべて越えたら null） */
export function nextGoal(goals: readonly Goal[]): Goal | null {
  return goals.find((g) => !g.done) ?? null;
}
