/**
 * リポジトリの Drizzle 実装
 *
 * D1（本番・wrangler dev）と node:sqlite（テスト・ジョブのローカル実行）の両方で同じコードが動く。
 * 受け取るのは Drizzle の「非同期 SQLite」型だけで、D1 固有の API は使わない。
 *
 * ランキングの並び順（packages/shared/src/ranking/rankKey.ts と同じ）:
 *   shifts_cleared DESC → score_digits DESC → score_head DESC → score_text DESC → submitted_at ASC
 * 桁数が同じ数字の文字列は、辞書順 = 数値の大小になる（数字だけなので照合順序の違いも出ない）。
 * そのため head が同じでも score_text の比較で完全な順位が SQL だけで決まる。
 */
import { and, asc, desc, eq, gt, lt, or, sql, type SQL } from 'drizzle-orm';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type { PartId, RunConfig, RunOp } from '@chain-factory/sim';
import type { RankKey } from '@chain-factory/shared';
import * as schema from '../db/schema';
import type { RankedRow, Repositories, SessionRecord } from './types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 実行結果の型はドライバーごとに違うため
export type AsyncSqliteDb = BaseSQLiteDatabase<'async', any, typeof schema>;

const { players, dailies, dailySessions, dailyResults, shopStats, marketPrices } = schema;

/** 非表示でないプレイヤーの結果だけに絞る条件 */
const visible = eq(players.hidden, 0);

/** key より上位の行の条件（並び順の定義をそのまま条件式にしたもの） */
function aboveCondition(key: RankKey): SQL {
  const r = dailyResults;
  return or(
    gt(r.shiftsCleared, key.shiftsCleared),
    and(
      eq(r.shiftsCleared, key.shiftsCleared),
      or(
        gt(r.scoreDigits, key.score.digits),
        and(
          eq(r.scoreDigits, key.score.digits),
          or(
            gt(r.scoreHead, key.score.head),
            and(
              eq(r.scoreHead, key.score.head),
              or(
                gt(r.scoreText, key.score.text),
                and(eq(r.scoreText, key.score.text), lt(r.submittedAt, key.submittedAt)),
              ),
            ),
          ),
        ),
      ),
    ),
  )!;
}

const toSession = (row: typeof dailySessions.$inferSelect): SessionRecord => ({
  dailyId: row.dailyId,
  playerId: row.playerId,
  ops: JSON.parse(row.opsJson) as RunOp[][],
  shiftIndex: row.shiftIndex,
  status: row.status as SessionRecord['status'],
  ranked: row.ranked === 1,
  updatedAt: row.updatedAt,
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
    },

    dailies: {
      async find(id) {
        const row = await db.select().from(dailies).where(eq(dailies.id, id)).get();
        if (!row) return null;
        return {
          id: row.id,
          number: row.number,
          config: JSON.parse(row.configJson) as RunConfig,
          seedCommitment: row.seedCommitment,
          simVersion: row.simVersion,
          opensAt: row.opensAt,
          closesAt: row.closesAt,
        };
      },
      async createIfAbsent(d) {
        await db
          .insert(dailies)
          .values({
            id: d.id,
            number: d.number,
            configJson: JSON.stringify(d.config),
            seedCommitment: d.seedCommitment,
            simVersion: d.simVersion,
            opensAt: d.opensAt,
            closesAt: d.closesAt,
          })
          .onConflictDoNothing();
      },
    },

    sessions: {
      async find(dailyId, playerId) {
        const row = await db
          .select()
          .from(dailySessions)
          .where(and(eq(dailySessions.dailyId, dailyId), eq(dailySessions.playerId, playerId)))
          .get();
        return row ? toSession(row) : null;
      },
      async create(s) {
        // 主キー（daily_id, player_id）が重なれば何も入らない → 1日1回を DB で保証
        const inserted = await db
          .insert(dailySessions)
          .values({
            dailyId: s.dailyId,
            playerId: s.playerId,
            opsJson: JSON.stringify(s.ops),
            shiftIndex: s.shiftIndex,
            status: s.status,
            ranked: s.ranked ? 1 : 0,
            updatedAt: s.updatedAt,
          })
          .onConflictDoNothing()
          .returning({ id: dailySessions.playerId });
        return inserted.length > 0;
      },
      async update(s, expectedShiftIndex) {
        const updated = await db
          .update(dailySessions)
          .set({
            opsJson: JSON.stringify(s.ops),
            shiftIndex: s.shiftIndex,
            status: s.status,
            updatedAt: s.updatedAt,
          })
          .where(
            and(
              eq(dailySessions.dailyId, s.dailyId),
              eq(dailySessions.playerId, s.playerId),
              eq(dailySessions.shiftIndex, expectedShiftIndex),
            ),
          )
          .returning({ id: dailySessions.playerId });
        return updated.length > 0;
      },
    },

    results: {
      async put(r) {
        const values = {
          dailyId: r.dailyId,
          playerId: r.playerId,
          shiftsCleared: r.shiftsCleared,
          scoreDigits: r.score.digits,
          scoreHead: r.score.head,
          scoreText: r.score.text,
          maxChain: r.maxChain,
          submittedAt: r.submittedAt,
        };
        await db
          .insert(dailyResults)
          .values(values)
          .onConflictDoUpdate({
            target: [dailyResults.dailyId, dailyResults.playerId],
            set: values,
          });
      },
      async find(dailyId, playerId) {
        const row = await db
          .select()
          .from(dailyResults)
          .where(and(eq(dailyResults.dailyId, dailyId), eq(dailyResults.playerId, playerId)))
          .get();
        if (!row) return null;
        return {
          dailyId: row.dailyId,
          playerId: row.playerId,
          shiftsCleared: row.shiftsCleared,
          score: { digits: row.scoreDigits, head: row.scoreHead, text: row.scoreText },
          maxChain: row.maxChain,
          submittedAt: row.submittedAt,
        };
      },
      async count(dailyId) {
        const row = await db
          .select({ n: sql<number>`count(*)` })
          .from(dailyResults)
          .innerJoin(players, eq(players.id, dailyResults.playerId))
          .where(and(eq(dailyResults.dailyId, dailyId), visible))
          .get();
        return Number(row?.n ?? 0);
      },
      async countAbove(dailyId, key) {
        const row = await db
          .select({ n: sql<number>`count(*)` })
          .from(dailyResults)
          .innerJoin(players, eq(players.id, dailyResults.playerId))
          .where(and(eq(dailyResults.dailyId, dailyId), visible, aboveCondition(key)))
          .get();
        return Number(row?.n ?? 0);
      },
      async list(dailyId, offset, limit) {
        const rows = await db
          .select({ result: dailyResults, displayName: players.displayName })
          .from(dailyResults)
          .innerJoin(players, eq(players.id, dailyResults.playerId))
          .where(and(eq(dailyResults.dailyId, dailyId), visible))
          .orderBy(
            desc(dailyResults.shiftsCleared),
            desc(dailyResults.scoreDigits),
            desc(dailyResults.scoreHead),
            desc(dailyResults.scoreText),
            asc(dailyResults.submittedAt),
          )
          .limit(limit)
          .offset(offset);
        return rows.map(({ result: r, displayName }): RankedRow => ({
          dailyId: r.dailyId,
          playerId: r.playerId,
          shiftsCleared: r.shiftsCleared,
          score: { digits: r.scoreDigits, head: r.scoreHead, text: r.scoreText },
          maxChain: r.maxChain,
          submittedAt: r.submittedAt,
          displayName,
        }));
      },
    },

    shopStats: {
      async add(dailyId, rows) {
        // 1行ずつ加算する（件数はパーツ種類数 = 20程度なので十分。D1 の1回あたりのクエリ上限にも収まる）
        for (const row of rows) {
          await db
            .insert(shopStats)
            .values({ dailyId, partId: row.partId, offered: row.offered, bought: row.bought })
            .onConflictDoUpdate({
              target: [shopStats.dailyId, shopStats.partId],
              set: {
                offered: sql`${shopStats.offered} + ${row.offered}`,
                bought: sql`${shopStats.bought} + ${row.bought}`,
              },
            });
        }
      },
      async get(dailyId) {
        const rows = await db.select().from(shopStats).where(eq(shopStats.dailyId, dailyId));
        return rows.map((r) => ({
          partId: r.partId as PartId,
          offered: r.offered,
          bought: r.bought,
        }));
      },
    },

    market: {
      async put(date, rows) {
        for (const row of rows) {
          const values = { date, ...row };
          await db
            .insert(marketPrices)
            .values(values)
            .onConflictDoUpdate({ target: [marketPrices.date, marketPrices.partId], set: values });
        }
      },
      async get(date) {
        const rows = await db.select().from(marketPrices).where(eq(marketPrices.date, date));
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
