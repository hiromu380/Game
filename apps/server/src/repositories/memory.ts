/**
 * リポジトリのメモリ実装（ドメインロジックのテスト用）
 *
 * 並び順・一意制約などの振る舞いは drizzle 実装と同じにしておく
 * （同じテストを両方の実装に流して確認する: test/repositories.test.ts）。
 */
import { compareRankKey } from '@chain-factory/shared';
import type {
  AttemptRecord,
  AttemptResultRecord,
  BestRecord,
  ExternalAccountRecord,
  FinalizationRecord,
  MarketRow,
  PlayerRecord,
  RankedBest,
  Repositories,
  ShopStatRow,
  StandingRecord,
  WeekRecord,
} from './types';

const clone = <T>(value: T): T => structuredClone(value);
const key2 = (a: string, b: string) => `${a}\u0000${b}`;
const key3 = (a: string, b: string, c: string) => `${a}\u0000${b}\u0000${c}`;

/** ランキングの並び順（同順は playerId の順: 確定の順位を毎回同じにするため） */
const byRank = (a: BestRecord, b: BestRecord) =>
  compareRankKey(a, b) || (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0);

/** Map から、週が weekId より前の行を消す */
function deleteBefore<T extends { weekId: string }>(map: Map<string, T>, weekId: string): number {
  let count = 0;
  for (const [k, v] of map) {
    if (v.weekId < weekId) {
      map.delete(k);
      count++;
    }
  }
  return count;
}

export function createMemoryRepositories(): Repositories {
  const players = new Map<string, PlayerRecord>();
  const externalAccounts = new Map<string, ExternalAccountRecord>();
  const weeks = new Map<string, WeekRecord>();
  const attempts = new Map<string, AttemptRecord>();
  const attemptResults = new Map<string, AttemptResultRecord>();
  const bests = new Map<string, BestRecord>();
  const standings = new Map<string, StandingRecord>();
  const finalizations = new Map<string, FinalizationRecord>();
  const shopStats = new Map<string, Map<string, ShopStatRow>>();
  const market = new Map<string, MarketRow[]>();

  const bestsOf = (weekId: string) => [...bests.values()].filter((b) => b.weekId === weekId);
  /** 表示対象（非表示でない）のベスト */
  const visibleBests = (weekId: string) =>
    bestsOf(weekId).filter((b) => !players.get(b.playerId)?.hidden);
  const withPlayer = (s: StandingRecord) => ({
    ...clone(s),
    displayName: players.get(s.playerId)?.displayName ?? '',
    hidden: players.get(s.playerId)?.hidden ?? false,
  });

  return {
    players: {
      async create(player) {
        players.set(player.id, clone(player));
      },
      async findById(id) {
        const p = players.get(id);
        return p ? clone(p) : null;
      },
      async updateName(id, displayName) {
        const p = players.get(id);
        if (p) p.displayName = displayName;
      },
      async updateTokenHash(id, tokenHash) {
        const p = players.get(id);
        if (p) p.tokenHash = tokenHash;
      },
      async clearIpHashesBefore(before) {
        let count = 0;
        for (const p of players.values()) {
          if (p.createdAt < before && p.registeredIpHash !== null) {
            p.registeredIpHash = null;
            count++;
          }
        }
        return count;
      },
    },
    externalAccounts: {
      async findPlayerId(provider, subjectHash) {
        return externalAccounts.get(key2(provider, subjectHash))?.playerId ?? null;
      },
      async create(record) {
        const k = key2(record.provider, record.subjectHash);
        if (externalAccounts.has(k)) return false;
        externalAccounts.set(k, clone(record));
        return true;
      },
    },
    weeks: {
      async find(id) {
        const w = weeks.get(id);
        return w ? clone(w) : null;
      },
      async createIfAbsent(record) {
        if (!weeks.has(record.id)) weeks.set(record.id, clone(record));
      },
      async save(record) {
        weeks.set(record.id, clone(record));
      },
    },
    attempts: {
      async find(weekId, dayId, playerId) {
        const a = attempts.get(key3(weekId, dayId, playerId));
        return a ? clone(a) : null;
      },
      async create(attempt) {
        const k = key3(attempt.weekId, attempt.dayId, attempt.playerId);
        if (attempts.has(k)) return false;
        attempts.set(k, clone(attempt));
        return true;
      },
      async update(attempt, expectedShiftIndex) {
        const k = key3(attempt.weekId, attempt.dayId, attempt.playerId);
        const current = attempts.get(k);
        if (!current || current.shiftIndex !== expectedShiftIndex) return false;
        attempts.set(k, clone(attempt));
        return true;
      },
      async listByPlayer(weekId, playerId) {
        return [...attempts.values()]
          .filter((a) => a.weekId === weekId && a.playerId === playerId)
          .sort((a, b) => (a.dayId < b.dayId ? -1 : 1))
          .map(clone);
      },
      async deleteWeeksBefore(weekId) {
        return deleteBefore(attempts, weekId);
      },
    },
    attemptResults: {
      async put(result) {
        attemptResults.set(key3(result.weekId, result.dayId, result.playerId), clone(result));
      },
      async find(weekId, dayId, playerId) {
        const r = attemptResults.get(key3(weekId, dayId, playerId));
        return r ? clone(r) : null;
      },
      async deleteWeeksBefore(weekId) {
        return deleteBefore(attemptResults, weekId);
      },
    },
    bests: {
      async find(weekId, playerId) {
        const b = bests.get(key2(weekId, playerId));
        return b ? clone(b) : null;
      },
      async put(best) {
        bests.set(key2(best.weekId, best.playerId), clone(best));
      },
      async count(weekId) {
        return visibleBests(weekId).length;
      },
      async listRanked(weekId) {
        return visibleBests(weekId)
          .sort(byRank)
          .map((b): RankedBest => ({
            ...clone(b),
            displayName: players.get(b.playerId)!.displayName,
          }));
      },
      async listAll(weekId) {
        return bestsOf(weekId).sort(byRank).map(clone);
      },
    },
    standings: {
      async putMany(rows) {
        for (const r of rows) standings.set(key2(r.weekId, r.playerId), clone(r));
      },
      async find(weekId, playerId) {
        const s = standings.get(key2(weekId, playerId));
        return s ? withPlayer(s) : null;
      },
      async list(weekId, fromRank, limit) {
        return [...standings.values()]
          .filter((s) => s.weekId === weekId && s.rank >= fromRank)
          .sort((a, b) => a.rank - b.rank)
          .slice(0, limit)
          .map(withPlayer);
      },
      async deleteWeeksBefore(weekId) {
        return deleteBefore(standings, weekId);
      },
    },
    finalizations: {
      async find(weekId) {
        const f = finalizations.get(weekId);
        return f ? clone(f) : null;
      },
      async save(record) {
        finalizations.set(record.weekId, clone(record));
      },
      async listFinished(limit) {
        return [...finalizations.values()]
          .filter((f) => f.finishedAt !== null)
          .map((f) => f.weekId)
          .sort()
          .reverse()
          .slice(0, limit);
      },
    },
    shopStats: {
      async add(weekId, rows) {
        const day = shopStats.get(weekId) ?? new Map<string, ShopStatRow>();
        for (const row of rows) {
          const current = day.get(row.partId) ?? { partId: row.partId, offered: 0, bought: 0 };
          day.set(row.partId, {
            partId: row.partId,
            offered: current.offered + row.offered,
            bought: current.bought + row.bought,
          });
        }
        shopStats.set(weekId, day);
      },
      async get(weekId) {
        return [...(shopStats.get(weekId)?.values() ?? [])].map(clone);
      },
    },
    market: {
      async put(weekId, rows) {
        market.set(weekId, clone(rows));
      },
      async get(weekId) {
        const rows = market.get(weekId);
        return rows ? clone(rows) : null;
      },
    },
  };
}
