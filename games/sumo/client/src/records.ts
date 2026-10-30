/**
 * 部屋の歴代記録と殿堂（元弟子と今の弟子から数える。純粋関数）
 */
import type { Alumnus, Career, GameState } from '@ichimon/sim';

export type RecordKey =
  | 'wins'
  | 'makuuchiYusho'
  | 'makuuchiBasho'
  | 'sekitoriBasho'
  | 'sansho'
  | 'kinboshi'
  | 'kimarite'
  | 'earnings';

export const RECORD_KEYS: readonly RecordKey[] = [
  'wins',
  'makuuchiYusho',
  'makuuchiBasho',
  'sekitoriBasho',
  'sansho',
  'kinboshi',
  'kimarite',
  'earnings',
];

const VALUE: Record<RecordKey, (c: Career) => number> = {
  wins: (c) => c.wins,
  makuuchiYusho: (c) => c.makuuchiYusho,
  makuuchiBasho: (c) => c.makuuchiBasho,
  sekitoriBasho: (c) => c.sekitoriBasho,
  sansho: (c) => c.sansho.shukun + c.sansho.kanto + c.sansho.gino,
  kinboshi: (c) => c.kinboshi,
  // 白星をあげた決まり手の種類
  kimarite: (c) => Object.keys(c.kimarite ?? {}).length,
  earnings: (c) => c.earnings,
};

/** 新記録として知らせる下限（序盤の小さな記録の更新は知らせない） */
export const RECORD_NEWS_MIN: Record<RecordKey, number> = {
  wins: 200,
  makuuchiYusho: 1,
  makuuchiBasho: 12,
  sekitoriBasho: 24,
  sansho: 3,
  kinboshi: 3,
  kimarite: 20,
  earnings: 100_000_000,
};

export interface Holder {
  id: number;
  name: string;
  value: number;
  /** 今も部屋にいる弟子か */
  active: boolean;
}

export interface RecordRow {
  key: RecordKey;
  holders: Holder[];
}

function people(game: GameState): { id: number; name: string; career: Career; active: boolean }[] {
  const now = game.rikishi
    .filter((r) => r.stableId === game.player.stableId && r.career.basho > 0)
    .map((r) => ({ id: r.id, name: r.name, career: r.career, active: true }));
  const past = game.player.alumni.map((a) => ({
    id: a.id,
    name: a.name,
    career: a.career,
    active: false,
  }));
  return [...past, ...now];
}

/** 項目ごとの上位（同じ値は先に入門した＝ID の小さい方が上） */
export function stableRecords(game: GameState, top = 3): RecordRow[] {
  const all = people(game);
  return RECORD_KEYS.map((key) => ({
    key,
    holders: all
      .map((p) => ({ id: p.id, name: p.name, value: VALUE[key](p.career), active: p.active }))
      .filter((h) => h.value > 0)
      .sort((a, b) => b.value - a.value || a.id - b.id)
      .slice(0, top),
  }));
}

export interface RecordNews {
  key: RecordKey;
  holder: Holder;
  previous: Holder;
}

/** prev から next のあいだに、今の弟子が部屋の記録を塗り替えた項目 */
export function recordsBroken(prev: GameState, next: GameState): RecordNews[] {
  const before = stableRecords(prev, 1);
  const after = stableRecords(next, 1);
  const out: RecordNews[] = [];
  RECORD_KEYS.forEach((key, i) => {
    const old = before[i]!.holders[0];
    const now = after[i]!.holders[0];
    if (!old || !now || !now.active || now.id === old.id) return;
    if (now.value <= old.value || now.value < RECORD_NEWS_MIN[key]) return;
    out.push({ key, holder: now, previous: old });
  });
  return out;
}

export type FameReason = 'Y' | 'O' | 'yusho' | 'sansho';

/** 殿堂入りの基準: 横綱・大関・幕内優勝・三賞5回以上 */
export const FAME_SANSHO = 5;

export function fameReasons(a: Alumnus): FameReason[] {
  const top = a.career.highestRank;
  const out: FameReason[] = [];
  if (top?.title === 'Y') out.push('Y');
  else if (top?.title === 'O') out.push('O');
  if (a.career.makuuchiYusho > 0) out.push('yusho');
  if (VALUE.sansho(a.career) >= FAME_SANSHO) out.push('sansho');
  return out;
}

/** 殿堂（引退した元弟子のうち基準を満たす人。最高位の高い順、同じなら優勝の多い順） */
export function hallOfFame(game: GameState): Alumnus[] {
  return game.player.alumni
    .filter((a) => fameReasons(a).length > 0)
    .sort(
      (a, b) =>
        a.career.highestOrder - b.career.highestOrder ||
        b.career.makuuchiYusho - a.career.makuuchiYusho ||
        a.retiredBashoIndex - b.retiredBashoIndex,
    );
}
