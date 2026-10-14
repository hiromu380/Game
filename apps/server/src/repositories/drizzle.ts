/**
 * リポジトリの Drizzle 実装
 *
 * D1（本番・wrangler dev）と node:sqlite（テスト・ジョブのローカル実行）の両方で同じコードが動く。
 * 受け取るのは Drizzle の「非同期 SQLite」型だけで、D1 固有の API は使わない。
 *
 * ランキングの並び順（packages/shared/src/ranking/rankKey.ts と同じ。同順は player_id の順）:
 *   shifts_cleared DESC → score_digits DESC → score_head DESC → score_text DESC → submitted_at ASC
 * 桁数が同じ数字の文字列は、辞書順 = 数値の大小になる（数字だけなので照合順序の違いも出ない）。
 * そのため head が同じでも score_text の比較で完全な順位が SQL だけで決まる。
 */
import { and, asc, desc, eq, gte, isNotNull, lt, sql } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type { PartId, RunConfig, RunOp } from '@chain-factory/sim';
import * as schema from '../db/schema';
import type {
  AttemptRecord,
  BestRecord,
  Repositories,
  StandingRecord,
  StandingRow,
  VerifySample,
  WeekRecord,
} from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 実行結果の型はドライバーごとに違うため
export type AsyncSqliteDb = BaseSQLiteDatabase<'async', any, typeof schema>;

const {
  players,
  externalAccounts,
  weeks,
  weeklyAttempts,
  weeklyAttemptResults,
  weeklyBests,
  weeklyStandings,
  weeklyFinalizations,
  shopStats,
  marketPrices,
} = schema;

/** 非表示でないプレイヤーの結果だけに絞る条件 */
const visible = eq(players.hidden, 0);

/**
 * D1 の1つの文に渡せる値の上限（100）に収まる行数ずつに分ける
 * （複数行の INSERT は「列数 × 行数」の値を渡すため）
 */
function chunks<T>(rows: readonly T[], columns: number): T[][] {
  const size = Math.max(1, Math.floor(100 / columns));
  const out: T[][] = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

/** ランキングの並び順（同順は playerId の順） */
const rankOrder = [
  desc(weeklyBests.shiftsCleared),
  desc(weeklyBests.scoreDigits),
  desc(weeklyBests.scoreHead),
  desc(weeklyBests.scoreText),
  asc(weeklyBests.submittedAt),
  asc(weeklyBests.playerId),
];

const toWeek = (row: typeof weeks.$inferSelect): WeekRecord => ({
  id: row.id,
  number: row.number,
  candidate: row.candidate,
  fallback: row.fallback === 1,
  verifyState: row.verifyState as WeekRecord['verifyState'],
  verifySamples: JSON.parse(row.verifyJson) as VerifySample[],
  baseConfig: JSON.parse(row.baseConfigJson) as RunConfig,
  config: row.configJson ? (JSON.parse(row.configJson) as RunConfig) : null,
  marketState: row.marketState as WeekRecord['marketState'],
  seedCommitment: row.seedCommitment,
  simVersion: row.simVersion,
  opensAt: row.opensAt,
  closesAt: row.closesAt,
});

const fromWeek = (w: WeekRecord): typeof weeks.$inferInsert => ({
  id: w.id,
  number: w.number,
  candidate: w.candidate,
  fallback: w.fallback ? 1 : 0,
  verifyState: w.verifyState,
  verifyJson: JSON.stringify(w.verifySamples),
  baseConfigJson: JSON.stringify(w.baseConfig),
  configJson: w.config ? JSON.stringify(w.config) : null,
  marketState: w.marketState,
  seedCommitment: w.seedCommitment,
  simVersion: w.simVersion,
  opensAt: w.opensAt,
  closesAt: w.closesAt,
});

const toAttempt = (row: typeof weeklyAttempts.$inferSelect): AttemptRecord => ({
  weekId: row.weekId,
  dayId: row.dayId,
  playerId: row.playerId,
  ops: JSON.parse(row.opsJson) as RunOp[][],
  shiftIndex: row.shiftIndex,
  status: row.status as AttemptRecord['status'],
  startedAt: row.startedAt,
  updatedAt: row.updatedAt,
});

/** スコアの3列 */
const scoreOf = (r: { scoreDigits: number; scoreHead: number; scoreText: string }) => ({
  digits: r.scoreDigits,
  head: r.scoreHead,
  text: r.scoreText,
});

const toBest = (r: typeof weeklyBests.$inferSelect): BestRecord => ({
  weekId: r.weekId,
  playerId: r.playerId,
  dayId: r.dayId,
  shiftsCleared: r.shiftsCleared,
  score: scoreOf(r),
  maxChain: r.maxChain,
  submittedAt: r.submittedAt,
  daysPlayed: r.daysPlayed,
});

const fromBest = (b: BestRecord) => ({
  weekId: b.weekId,
  playerId: b.playerId,
  dayId: b.dayId,
  shiftsCleared: b.shiftsCleared,
  scoreDigits: b.score.digits,
  scoreHead: b.score.head,
  scoreText: b.score.text,
  maxChain: b.maxChain,
  submittedAt: b.submittedAt,
  daysPlayed: b.daysPlayed,
});

const toStanding = (
  r: typeof weeklyStandings.$inferSelect,
  p: { displayName: string; hidden: number },
): StandingRow => ({
  ...toBest(r as unknown as typeof weeklyBests.$inferSelect),
  rank: r.rank,
  topPercentMilli: r.topPercentMilli,
  displayName: p.displayName,
  hidden: p.hidden === 1,
});

export function createDrizzleRepositories(db: AsyncSqliteDb): Repositories {
  return {
    players: {
      async create(p) {
        await db.insert(players).values({ ...p, hidden: p.hidden ? 1 : 0 });
      },
      async findById(id) {
        const row = await db.select().from(players).where(eq(players.id, id)).get();
        return row ? { ...row, hidden: row.hidden === 1 } : null;
      },
      async updateName(id, displayName) {
        await db.update(players).set({ displayName }).where(eq(players.id, id));
      },
      async updateTokenHash(id, tokenHash) {
        await db.update(players).set({ tokenHash }).where(eq(players.id, id));
      },
      async clearIpHashesBefore(before) {
        const cleared = await db
          .update(players)
          .set({ registeredIpHash: null })
          .where(and(lt(players.createdAt, before), isNotNull(players.registeredIpHash)))
          .returning({ id: players.id });
        return cleared.length;
      },
    },

    externalAccounts: {
      async findPlayerId(provider, subjectHash) {
        const row = await db
          .select({ playerId: externalAccounts.playerId })
          .from(externalAccounts)
          .where(
            and(
              eq(externalAccounts.provider, provider),
              eq(externalAccounts.subjectHash, subjectHash),
            ),
          )
          .get();
        return row?.playerId ?? null;
      },
      async create(record) {
        // 主キー（provider, subject_hash）が重なれば何も入らない → 1つの外部 ID に1人を DB で保証
        const inserted = await db
          .insert(externalAccounts)
          .values(record)
          .onConflictDoNothing()
          .returning({ id: externalAccounts.playerId });
        return inserted.length > 0;
      },
    },

    weeks: {
      async find(id) {
        const row = await db.select().from(weeks).where(eq(weeks.id, id)).get();
        return row ? toWeek(row) : null;
      },
      async createIfAbsent(w) {
        await db.insert(weeks).values(fromWeek(w)).onConflictDoNothing();
      },
      async save(w) {
        const values = fromWeek(w);
        await db.update(weeks).set(values).where(eq(weeks.id, w.id));
      },
    },

    attempts: {
      async find(weekId, dayId, playerId) {
        const row = await db
          .select()
          .from(weeklyAttempts)
          .where(
            and(
              eq(weeklyAttempts.weekId, weekId),
              eq(weeklyAttempts.dayId, dayId),
              eq(weeklyAttempts.playerId, playerId),
            ),
          )
          .get();
        return row ? toAttempt(row) : null;
      },
      async create(a) {
        // 主キー（週・日・プレイヤー）が重なれば何も入らない → 1日1回を DB で保証
        const inserted = await db
          .insert(weeklyAttempts)
          .values({
            weekId: a.weekId,
            dayId: a.dayId,
            playerId: a.playerId,
            opsJson: JSON.stringify(a.ops),
            shiftIndex: a.shiftIndex,
            status: a.status,
            startedAt: a.startedAt,
            updatedAt: a.updatedAt,
          })
          .onConflictDoNothing()
          .returning({ id: weeklyAttempts.playerId });
        return inserted.length > 0;
      },
      async update(a, expectedShiftIndex) {
        const updated = await db
          .update(weeklyAttempts)
          .set({
            opsJson: JSON.stringify(a.ops),
            shiftIndex: a.shiftIndex,
            status: a.status,
            updatedAt: a.updatedAt,
          })
          .where(
            and(
              eq(weeklyAttempts.weekId, a.weekId),
              eq(weeklyAttempts.dayId, a.dayId),
              eq(weeklyAttempts.playerId, a.playerId),
              eq(weeklyAttempts.shiftIndex, expectedShiftIndex),
            ),
          )
          .returning({ id: weeklyAttempts.playerId });
        return updated.length > 0;
      },
      async listByPlayer(weekId, playerId) {
        const rows = await db
          .select()
          .from(weeklyAttempts)
          .where(and(eq(weeklyAttempts.weekId, weekId), eq(weeklyAttempts.playerId, playerId)))
          .orderBy(asc(weeklyAttempts.dayId));
        return rows.map(toAttempt);
      },
      async deleteWeeksBefore(weekId) {
        const deleted = await db
          .delete(weeklyAttempts)
          .where(lt(weeklyAttempts.weekId, weekId))
          .returning({ id: weeklyAttempts.playerId });
        return deleted.length;
      },
    },

    attemptResults: {
      async put(r) {
        const values = {
          weekId: r.weekId,
          dayId: r.dayId,
          playerId: r.playerId,
          shiftsCleared: r.shiftsCleared,
          scoreDigits: r.score.digits,
          scoreHead: r.score.head,
          scoreText: r.score.text,
          maxChain: r.maxChain,
          submittedAt: r.submittedAt,
        };
        await db
          .insert(weeklyAttemptResults)
          .values(values)
          .onConflictDoUpdate({
            target: [
              weeklyAttemptResults.weekId,
              weeklyAttemptResults.dayId,
              weeklyAttemptResults.playerId,
            ],
            set: values,
          });
      },
      async find(weekId, dayId, playerId) {
        const row = await db
          .select()
          .from(weeklyAttemptResults)
          .where(
            and(
              eq(weeklyAttemptResults.weekId, weekId),
              eq(weeklyAttemptResults.dayId, dayId),
              eq(weeklyAttemptResults.playerId, playerId),
            ),
          )
          .get();
        if (!row) return null;
        return {
          weekId: row.weekId,
          dayId: row.dayId,
          playerId: row.playerId,
          shiftsCleared: row.shiftsCleared,
          score: scoreOf(row),
          maxChain: row.maxChain,
          submittedAt: row.submittedAt,
        };
      },
      async deleteWeeksBefore(weekId) {
        const deleted = await db
          .delete(weeklyAttemptResults)
          .where(lt(weeklyAttemptResults.weekId, weekId))
          .returning({ id: weeklyAttemptResults.playerId });
        return deleted.length;
      },
    },

    bests: {
      async find(weekId, playerId) {
        const row = await db
          .select()
          .from(weeklyBests)
          .where(and(eq(weeklyBests.weekId, weekId), eq(weeklyBests.playerId, playerId)))
          .get();
        return row ? toBest(row) : null;
      },
      async put(b) {
        const values = fromBest(b);
        await db
          .insert(weeklyBests)
          .values(values)
          .onConflictDoUpdate({ target: [weeklyBests.weekId, weeklyBests.playerId], set: values });
      },
      async count(weekId) {
        const row = await db
          .select({ n: sql<number>`count(*)` })
          .from(weeklyBests)
          .innerJoin(players, eq(players.id, weeklyBests.playerId))
          .where(and(eq(weeklyBests.weekId, weekId), visible))
          .get();
        return Number(row?.n ?? 0);
      },
      async listRanked(weekId) {
        const rows = await db
          .select({ best: weeklyBests, displayName: players.displayName })
          .from(weeklyBests)
          .innerJoin(players, eq(players.id, weeklyBests.playerId))
          .where(and(eq(weeklyBests.weekId, weekId), visible))
          .orderBy(...rankOrder);
        return rows.map(({ best, displayName }) => ({ ...toBest(best), displayName }));
      },
      async listAll(weekId) {
        const rows = await db
          .select()
          .from(weeklyBests)
          .where(eq(weeklyBests.weekId, weekId))
          .orderBy(...rankOrder);
        return rows.map(toBest);
      },
    },

    standings: {
      async putMany(rows) {
        const values = rows.map((r: StandingRecord) => ({
          ...fromBest(r),
          rank: r.rank,
          topPercentMilli: r.topPercentMilli,
        }));
        for (const chunk of chunks(values, 13)) {
          await db
            .insert(weeklyStandings)
            .values(chunk)
            .onConflictDoUpdate({
              target: [weeklyStandings.weekId, weeklyStandings.playerId],
              set: {
                rank: sql`excluded.rank`,
                topPercentMilli: sql`excluded.top_percent_milli`,
                dayId: sql`excluded.day_id`,
                shiftsCleared: sql`excluded.shifts_cleared`,
                scoreDigits: sql`excluded.score_digits`,
                scoreHead: sql`excluded.score_head`,
                scoreText: sql`excluded.score_text`,
                maxChain: sql`excluded.max_chain`,
                submittedAt: sql`excluded.submitted_at`,
                daysPlayed: sql`excluded.days_played`,
              },
            });
        }
      },
      async find(weekId, playerId) {
        const row = await db
          .select({ s: weeklyStandings, displayName: players.displayName, hidden: players.hidden })
          .from(weeklyStandings)
          .innerJoin(players, eq(players.id, weeklyStandings.playerId))
          .where(and(eq(weeklyStandings.weekId, weekId), eq(weeklyStandings.playerId, playerId)))
          .get();
        return row ? toStanding(row.s, row) : null;
      },
      async list(weekId, fromRank, limit) {
        const rows = await db
          .select({ s: weeklyStandings, displayName: players.displayName, hidden: players.hidden })
          .from(weeklyStandings)
          .innerJoin(players, eq(players.id, weeklyStandings.playerId))
          .where(and(eq(weeklyStandings.weekId, weekId), gte(weeklyStandings.rank, fromRank)))
          .orderBy(asc(weeklyStandings.rank))
          .limit(limit);
        return rows.map((row) => toStanding(row.s, row));
      },
      async deleteWeeksBefore(weekId) {
        const deleted = await db
          .delete(weeklyStandings)
          .where(lt(weeklyStandings.weekId, weekId))
          .returning({ id: weeklyStandings.playerId });
        return deleted.length;
      },
    },

    finalizations: {
      async find(weekId) {
        const row = await db
          .select()
          .from(weeklyFinalizations)
          .where(eq(weeklyFinalizations.weekId, weekId))
          .get();
        return row ?? null;
      },
      async save(f) {
        await db
          .insert(weeklyFinalizations)
          .values(f)
          .onConflictDoUpdate({ target: weeklyFinalizations.weekId, set: f });
      },
      async listFinished(limit) {
        const rows = await db
          .select({ weekId: weeklyFinalizations.weekId })
          .from(weeklyFinalizations)
          .where(isNotNull(weeklyFinalizations.finishedAt))
          .orderBy(desc(weeklyFinalizations.weekId))
          .limit(limit);
        return rows.map((r) => r.weekId);
      },
    },

    shopStats: {
      async add(weekId, rows) {
        // 1行ずつ加算する（件数はパーツ種類数 = 20程度なので十分。D1 の1回あたりのクエリ上限にも収まる）
        for (const row of rows) {
          await db
            .insert(shopStats)
            .values({ weekId, partId: row.partId, offered: row.offered, bought: row.bought })
            .onConflictDoUpdate({
              target: [shopStats.weekId, shopStats.partId],
              set: {
                offered: sql`${shopStats.offered} + ${row.offered}`,
                bought: sql`${shopStats.bought} + ${row.bought}`,
              },
            });
        }
      },
      async get(weekId) {
        const rows = await db.select().from(shopStats).where(eq(shopStats.weekId, weekId));
        return rows.map((r) => ({
          partId: r.partId as PartId,
          offered: r.offered,
          bought: r.bought,
        }));
      },
    },

    market: {
      async put(weekId, rows) {
        for (const row of rows) {
          const values = { weekId, ...row };
          await db
            .insert(marketPrices)
            .values(values)
            .onConflictDoUpdate({
              target: [marketPrices.weekId, marketPrices.partId],
              set: values,
            });
        }
      },
      async get(weekId) {
        const rows = await db.select().from(marketPrices).where(eq(marketPrices.weekId, weekId));
        if (rows.length === 0) return null;
        return rows.map((r) => ({
          partId: r.partId as PartId,
          multiplierMilli: r.multiplierMilli,
          price: r.price,
        }));
      },
    },
  };
}
