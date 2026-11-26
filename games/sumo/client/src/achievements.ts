/**
 * 実績: 部屋を営むうちに達成する節目（約40）。部屋の歩みより細かい。
 * 元弟子と今の弟子の記録・日誌・代から数える純粋関数で、セーブに持たない。
 * 一度満たせば戻らない値（累計・最高位・日誌）だけを使う（お金や名声の今の値は使わない）
 */
import {
  KIMARITE_BY_ID,
  type Career,
  type GameState,
  type JournalEntry,
  type JournalEvent,
} from '@ichimon/sim';
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
const maxOf = (x: Ctx, f: (c: Career) => number) =>
  x.careers.reduce((m, c) => Math.max(m, f(c)), 0);
const sum = (x: Ctx, f: (c: Career) => number) => x.careers.reduce((s, c) => s + f(c), 0);
const sekitori = (x: Ctx) =>
  x.careers.filter((c) => c.sekitoriBasho > 0 || atLeast(c, 'juryo')).length;

/** 並びは一覧の順（グループごと） */
export const ACHIEVEMENTS = [
  // 弟子を集める
  { id: 'firstDeshi', group: 'deshi', test: (x: Ctx) => ev(x, 'join').length >= 1 },
  {
    id: 'deshi10',
    group: 'deshi',
    test: (x: Ctx) => ev(x, 'join').length >= 10,
    progress: (x: Ctx) => [ev(x, 'join').length, 10],
  },
  {
    id: 'deshi30',
    group: 'deshi',
    test: (x: Ctx) => ev(x, 'join').length >= 30,
    progress: (x: Ctx) => [ev(x, 'join').length, 30],
  },
  {
    id: 'scout10',
    group: 'deshi',
    test: (x: Ctx) => sum0(ev(x, 'scout').map((e) => e.count)) >= 10,
    progress: (x: Ctx) => [sum0(ev(x, 'scout').map((e) => e.count)), 10],
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
  {
    id: 'sekitori5',
    group: 'banzuke',
    test: (x: Ctx) => sekitori(x) >= 5,
    progress: (x: Ctx) => [sekitori(x), 5],
  },
  {
    id: 'sekitori10',
    group: 'banzuke',
    test: (x: Ctx) => sekitori(x) >= 10,
    progress: (x: Ctx) => [sekitori(x), 10],
  },
  // 優勝と三賞
  { id: 'lowerYusho', group: 'honors', test: (x: Ctx) => any(x, (c) => c.otherYusho > 0) },
  { id: 'makuuchiYusho', group: 'honors', test: (x: Ctx) => any(x, (c) => c.makuuchiYusho > 0) },
  {
    id: 'zensho',
    group: 'honors',
    test: (x: Ctx) => ev(x, 'yusho').some((e) => e.division === 'makuuchi' && e.wins === 15),
  },
  {
    id: 'yusho5',
    group: 'honors',
    test: (x: Ctx) => sum(x, (c) => c.makuuchiYusho) >= 5,
    progress: (x: Ctx) => [sum(x, (c) => c.makuuchiYusho), 5],
  },
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
  {
    id: 'wins300',
    group: 'records',
    test: (x: Ctx) => maxOf(x, (c) => c.wins) >= 300,
    progress: (x: Ctx) => [maxOf(x, (c) => c.wins), 300],
  },
  {
    id: 'wins600',
    group: 'records',
    test: (x: Ctx) => maxOf(x, (c) => c.wins) >= 600,
    progress: (x: Ctx) => [maxOf(x, (c) => c.wins), 600],
  },
  {
    id: 'makuuchi30',
    group: 'records',
    test: (x: Ctx) => maxOf(x, (c) => c.makuuchiBasho) >= 30,
    progress: (x: Ctx) => [maxOf(x, (c) => c.makuuchiBasho), 30],
  },
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
  {
    id: 'kimarite20',
    group: 'records',
    test: (x: Ctx) => kimariteKinds(x) >= 20,
    progress: (x: Ctx) => [kimariteKinds(x), 20],
  },
  // 部屋を営む
  {
    id: 'patrons5',
    group: 'stable',
    test: (x: Ctx) => ev(x, 'patron').filter((e) => e.event === 'join').length >= 5,
    progress: (x: Ctx) => [ev(x, 'patron').filter((e) => e.event === 'join').length, 5],
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
  {
    id: 'kakun3',
    group: 'kyokai',
    test: (x: Ctx) => ev(x, 'kakun').length >= 3,
    progress: (x: Ctx) => [ev(x, 'kakun').length, 3],
  },
  { id: 'gen2', group: 'kyokai', test: (x: Ctx) => x.generation >= 2 },
  { id: 'gen3', group: 'kyokai', test: (x: Ctx) => x.generation >= 3 },
] as const satisfies readonly {
  id: string;
  group: AchievementGroup;
  test: (x: Ctx) => boolean;
  /** 数で進む実績の、今の数と要る数（「入門 7／10」。目標を目の前に見せる） */
  progress?: (x: Ctx) => readonly [number, number];
}[];

/** 部屋が白星を挙げた決まり手の種類（非技を除く） */
function kimariteKinds(x: Ctx): number {
  const kinds = new Set<string>();
  for (const c of x.careers)
    for (const [id, n] of Object.entries(c.kimarite ?? {}))
      if (n > 0 && KIMARITE_BY_ID.get(id)?.group !== 'hiwaza') kinds.add(id);
  return kinds.size;
}

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

function ctxOf(game: GameState): Ctx {
  return {
    careers: stablePeople(game).map((p) => p.career),
    journal: game.journal,
    generation: game.player.generation,
  };
}

/** 達成した実績の id（一覧の順） */
export function achievedOf(game: GameState): AchievementId[] {
  const x = ctxOf(game);
  return ACHIEVEMENTS.filter((a) => a.test(x)).map((a) => a.id);
}

/** まだの実績の進み具合（数で進むものだけ。今の数は要る数で止める） */
export function progressOf(game: GameState): Map<AchievementId, { now: number; of: number }> {
  const x = ctxOf(game);
  const out = new Map<AchievementId, { now: number; of: number }>();
  for (const a of ACHIEVEMENTS) {
    if (!('progress' in a) || a.test(x)) continue;
    const [now, of] = a.progress(x);
    out.set(a.id, { now: Math.min(now, of), of });
  }
  return out;
}

/** もうすぐ届く実績（進み具合の割合が高い順。0 は出さない） */
export function nearAchievements(
  game: GameState,
  n = 3,
): { id: AchievementId; now: number; of: number }[] {
  return [...progressOf(game)]
    .filter(([, p]) => p.now > 0)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => b.now / b.of - a.now / a.of)
    .slice(0, n);
}

/** 前の状態から新しく達成した実績（場所の後に知らせる） */
export function newlyAchieved(before: GameState, after: GameState): AchievementId[] {
  const had = new Set(achievedOf(before));
  return achievedOf(after).filter((id) => !had.has(id));
}

/** 部屋の格: 実績の数で上がる（ご褒美。箱庭の門の脇に祝い樽と提灯が増える） */
export const STABLE_TIERS = [0, 5, 12, 20, 30, 40] as const;
export type StableTier = 0 | 1 | 2 | 3 | 4 | 5;

export function tierOf(achieved: number): StableTier {
  let tier = 0;
  STABLE_TIERS.forEach((need, i) => {
    if (achieved >= need) tier = i;
  });
  return tier as StableTier;
}

/** 次の格に要る実績の数（いちばん上なら null） */
export function nextTierAt(tier: StableTier): number | null {
  return STABLE_TIERS[tier + 1] ?? null;
}
