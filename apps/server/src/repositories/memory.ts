/**
 * リポジトリのメモリ実装（ドメインロジックのテスト用）
 *
 * 並び順・一意制約などの振る舞いは drizzle 実装と同じにしておく
 * （同じテストを両方の実装に流して確認する: test/repositories.test.ts）。
 */
import { compareRankKey, type RankKey } from '@chain-factory/shared';
import type {
  DailyRecord,
  ExternalAccountRecord,
  MarketRow,
  PlayerRecord,
  RankedRow,
  Repositories,
  ResultRecord,
  SessionRecord,
  ShopStatRow,
} from './types';

const clone = <T>(value: T): T => structuredClone(value);
const key2 = (a: string, b: string) => `${a}\u0000${b}`;

const toRankKey = (r: ResultRecord): RankKey => ({
  shiftsCleared: r.shiftsCleared,
  score: r.score,
  submittedAt: r.submittedAt,
});

export function createMemoryRepositories(): Repositories {
  const players = new Map<string, PlayerRecord>();
  const externalAccounts = new Map<string, ExternalAccountRecord>();
  const dailies = new Map<string, DailyRecord>();
  const sessions = new Map<string, SessionRecord>();
  const results = new Map<string, ResultRecord>();
  const shopStats = new Map<string, Map<string, ShopStatRow>>();
  const market = new Map<string, MarketRow[]>();

  /** 表示対象（非表示でない）の結果 */
  const visibleResults = (dailyId: string) =>
    [...results.values()].filter((r) => r.dailyId === dailyId && !players.get(r.playerId)?.hidden);

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
    dailies: {
      async find(id) {
        const d = dailies.get(id);
        return d ? clone(d) : null;
      },
      async createIfAbsent(record) {
        if (!dailies.has(record.id)) dailies.set(record.id, clone(record));
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
    sessions: {
      async find(dailyId, playerId) {
        const s = sessions.get(key2(dailyId, playerId));
        return s ? clone(s) : null;
      },
      async create(session) {
        const k = key2(session.dailyId, session.playerId);
        if (sessions.has(k)) return false;
        sessions.set(k, clone(session));
        return true;
      },
      async update(session, expectedShiftIndex) {
        const k = key2(session.dailyId, session.playerId);
        const current = sessions.get(k);
        if (!current || current.shiftIndex !== expectedShiftIndex) return false;
        sessions.set(k, clone(session));
        return true;
      },
    },
    results: {
      async put(result) {
        results.set(key2(result.dailyId, result.playerId), clone(result));
      },
      async find(dailyId, playerId) {
        const r = results.get(key2(dailyId, playerId));
        return r ? clone(r) : null;
      },
      async count(dailyId) {
        return visibleResults(dailyId).length;
      },
      async countAbove(dailyId, key) {
        return visibleResults(dailyId).filter((r) => compareRankKey(toRankKey(r), key) < 0).length;
      },
      async list(dailyId, offset, limit) {
        return visibleResults(dailyId)
          .sort((a, b) => compareRankKey(toRankKey(a), toRankKey(b)))
          .slice(offset, offset + limit)
          .map((r): RankedRow => ({
            ...clone(r),
            displayName: players.get(r.playerId)!.displayName,
          }));
      },
    },
    shopStats: {
      async add(dailyId, rows) {
        const day = shopStats.get(dailyId) ?? new Map<string, ShopStatRow>();
        for (const row of rows) {
          const current = day.get(row.partId) ?? { partId: row.partId, offered: 0, bought: 0 };
          day.set(row.partId, {
            partId: row.partId,
            offered: current.offered + row.offered,
            bought: current.bought + row.bought,
          });
        }
        shopStats.set(dailyId, day);
      },
      async get(dailyId) {
        return [...(shopStats.get(dailyId)?.values() ?? [])].map(clone);
      },
    },
    market: {
      async put(date, rows) {
        market.set(date, clone(rows));
      },
      async get(date) {
        const rows = market.get(date);
        return rows ? clone(rows) : null;
      },
    },
  };
}
