/**
 * 実績: 部屋を営むうちに達成する節目（約40）。部屋の歩みより細かい。
 * 元弟子と今の弟子の記録・日誌・代から数える純粋関数で、セーブに持たない。
 * 一度満たせば戻らない値（累計・最高位・日誌）だけを使う（お金や名声の今の値は使わない）
 */
import type { Career, GameState, JournalEntry, JournalEvent } from '@ichimon/sim';
import { stablePeople } from './records';

export type AchievementGroup = 'deshi' | 'banzuke' | 'honors' | 'records' | 'stable' | 'kyokai';

interface Ctx {
  careers: Career[];
  journal: JournalEntry[];
  generation: number;
}

type Kind = JournalEvent['kind'];
const ev = <K extends Kind>(x: Ctx, kind: K) =>
  x.journal.filter((e): e is JournalEntry & Extract<JournalEvent, { kind: K }> => e.kind === kind);
const top = (c: Career) => c.highestRank;
const atLeast = (c: Career, div: string) => {
  const order = ['makuuchi', 'juryo', 'makushita', 'sandanme', 'jonidan', 'jonokuchi'];
  const r = top(c);
  return r !== null && order.indexOf(r.division) <= order.indexOf(div);
};
const titled = (c: Career, ts: string[]) => ts.includes(top(c)?.title ?? '');
const any = (x: Ctx, f: (c: Career) => boolean) => x.careers.some(f);
const sum = (x: Ctx, f: (c: Career) => number) => x.careers.reduce((s, c) => s + f(c), 0);
const sekitori = (x: Ctx) =>
  x.careers.filter((c) => c.sekitoriBasho > 0 || atLeast(c, 'juryo')).length;

/** 並びは一覧の順（グループごと） */
export const ACHIEVEMENTS = [
  // 弟子を集める
  { id: 'firstDeshi', group: 'deshi', test: (x: Ctx) => ev(x, 'join').length >= 1 },
  { id: 'deshi10', group: 'deshi', test: (x: Ctx) => ev(x, 'join').length >= 10 },
  { id: 'deshi30', group: 'deshi', test: (x: Ctx) => ev(x, 'join').length >= 30 },
  {
    id: 'scout10',
    group: 'deshi',
    test: (x: Ctx) => sum0(ev(x, 'scout').map((e) => e.count)) >= 10,
  },
  {
    id: 'overseas',
    group: 'deshi',
    test: (x: Ctx) => ev(x, 'scout').some((e) => e.trip === 'overseas' && e.count > 0),
  },
  {
    id: 'college',
    group: 'deshi',
    test: (x: Ctx) => ev(x, 'scout').some((e) => e.trip === 'collegeMeet' && e.count > 0),
  },
  // 番付
  { id: 'makushita', group: 'banzuke', test: (x: Ctx) => any(x, (c) => atLeast(c, 'makushita')) },
  { id: 'sekitori', group: 'banzuke', test: (x: Ctx) => sekitori(x) >= 1 },
  { id: 'makuuchi', group: 'banzuke', test: (x: Ctx) => any(x, (c) => atLeast(c, 'makuuchi')) },
  {
    id: 'sanyaku',
    group: 'banzuke',
    test: (x: Ctx) => any(x, (c) => titled(c, ['K', 'S', 'O', 'Y'])),
  },
  { id: 'ozeki', group: 'banzuke', test: (x: Ctx) => any(x, (c) => titled(c, ['O', 'Y'])) },
  { id: 'yokozuna', group: 'banzuke', test: (x: Ctx) => any(x, (c) => titled(c, ['Y'])) },
  { id: 'sekitori5', group: 'banzuke', test: (x: Ctx) => sekitori(x) >= 5 },
  { id: 'sekitori10', group: 'banzuke', test: (x: Ctx) => sekitori(x) >= 10 },
  // 優勝と三賞
  { id: 'lowerYusho', group: 'honors', test: (x: Ctx) => any(x, (c) => c.otherYusho > 0) },
  { id: 'makuuchiYusho', group: 'honors', test: (x: Ctx) => any(x, (c) => c.makuuchiYusho > 0) },
  {
    id: 'zensho',
    group: 'honors',
    test: (x: Ctx) => ev(x, 'yusho').some((e) => e.division === 'makuuchi' && e.wins === 15),
  },
  { id: 'yusho5', group: 'honors', test: (x: Ctx) => sum(x, (c) => c.makuuchiYusho) >= 5 },
  {
    id: 'sansho',
    group: 'honors',
    test: (x: Ctx) => any(x, (c) => c.sansho.shukun + c.sansho.kanto + c.sansho.gino > 0),
  },
  {
    id: 'sanshoAll',
    group: 'honors',
    test: (x: Ctx) =>
      (['shukun', 'kanto', 'gino'] as const).every((k) => any(x, (c) => c.sansho[k] > 0)),
  },
  { id: 'kinboshi', group: 'honors', test: (x: Ctx) => any(x, (c) => c.kinboshi > 0) },
  { id: 'kojo', group: 'honors', test: (x: Ctx) => ev(x, 'kojo').length >= 1 },
  // 力士の記録
  { id: 'wins300', group: 'records', test: (x: Ctx) => any(x, (c) => c.wins >= 300) },
  { id: 'wins600', group: 'records', test: (x: Ctx) => any(x, (c) => c.wins >= 600) },
  { id: 'makuuchi30', group: 'records', test: (x: Ctx) => any(x, (c) => c.makuuchiBasho >= 30) },
  {
    id: 'ironman',
    group: 'records',
    test: (x: Ctx) => any(x, (c) => c.basho >= 60 && c.absences === 0),
  },
  {
    id: 'kokugikan',
    group: 'records',
    test: (x: Ctx) => ev(x, 'danpatsu').some((e) => e.venue === 'kokugikan'),
  },
  { id: 'oyakata', group: 'records', test: (x: Ctx) => ev(x, 'retire').some((e) => !!e.oyakata) },
  // 部屋を営む
  {
    id: 'patrons5',
    group: 'stable',
    test: (x: Ctx) => ev(x, 'patron').filter((e) => e.event === 'join').length >= 5,
  },
  {
    id: 'keshoPatron',
    group: 'stable',
    test: (x: Ctx) => ev(x, 'kesho').some((e) => e.from === 'patron'),
  },
  {
    id: 'pledgeKept',
    group: 'stable',
    test: (x: Ctx) => ev(x, 'pledge').some((e) => e.result === 'kept'),
  },
  {
    id: 'pledgeSekitori',
    group: 'stable',
    test: (x: Ctx) => ev(x, 'pledge').some((e) => e.result === 'kept' && e.pledge === 'sekitori'),
  },
  {
    id: 'dormMax',
    group: 'stable',
    test: (x: Ctx) => ev(x, 'facility').some((e) => e.id === 'dorm' && e.level >= 2),
  },
  {
    id: 'dojoMax',
    group: 'stable',
    test: (x: Ctx) => ev(x, 'facility').some((e) => e.id === 'dojo' && e.level >= 3),
  },
  {
    id: 'staff',
    group: 'stable',
    test: (x: Ctx) => new Set(ev(x, 'staffHire').map((e) => e.role)).size >= 2,
  },
  {
    id: 'uragata',
    group: 'stable',
    test: (x: Ctx) =>
      new Set(
        ev(x, 'uragata')
          .filter((e) => e.event === 'join')
          .map((e) => e.role),
      ).size >= 3,
  },
  // 協会と一門
  {
    id: 'iin',
    group: 'kyokai',
    test: (x: Ctx) =>
      ev(x, 'office').some((e) =>
        ['iin', 'yakuinTaiguu', 'fukuRiji', 'riji', 'rijicho'].includes(e.rank),
      ),
  },
  {
    id: 'riji',
    group: 'kyokai',
    test: (x: Ctx) =>
      ev(x, 'election').some(
        (e) => e.result === 'elected' && (e.rank === 'riji' || e.rank === 'rijicho'),
      ) || ev(x, 'office').some((e) => e.rank === 'riji' || e.rank === 'rijicho'),
  },
  {
    id: 'rijicho',
    group: 'kyokai',
    test: (x: Ctx) =>
      ev(x, 'office').some((e) => e.rank === 'rijicho') ||
      ev(x, 'election').some((e) => e.rank === 'rijicho'),
  },
  { id: 'branch', group: 'kyokai', test: (x: Ctx) => ev(x, 'independence').length >= 1 },
  { id: 'kakun3', group: 'kyokai', test: (x: Ctx) => ev(x, 'kakun').length >= 3 },
  { id: 'gen2', group: 'kyokai', test: (x: Ctx) => x.generation >= 2 },
  { id: 'gen3', group: 'kyokai', test: (x: Ctx) => x.generation >= 3 },
] as const satisfies readonly { id: string; group: AchievementGroup; test: (x: Ctx) => boolean }[];

function sum0(xs: number[]): number {
  return xs.reduce((s, v) => s + v, 0);
}

export type AchievementId = (typeof ACHIEVEMENTS)[number]['id'];
export const ACHIEVEMENT_GROUPS: AchievementGroup[] = [
  'deshi',
  'banzuke',
  'honors',
  'records',
  'stable',
  'kyokai',
];

/** 達成した実績の id（一覧の順） */
export function achievedOf(game: GameState): AchievementId[] {
  const x: Ctx = {
    careers: stablePeople(game).map((p) => p.career),
    journal: game.journal,
    generation: game.player.generation,
  };
  return ACHIEVEMENTS.filter((a) => a.test(x)).map((a) => a.id);
}

/** 前の状態から新しく達成した実績（場所の後に知らせる） */
export function newlyAchieved(before: GameState, after: GameState): AchievementId[] {
  const had = new Set(achievedOf(before));
  return achievedOf(after).filter((id) => !had.has(id));
}
