/**
 * リポジトリ層のテスト
 * 同じテストをメモリ実装と Drizzle（node:sqlite）実装の両方に流し、振る舞いが同じことを確かめる。
 */
import { compareRankKey, toScoreColumns } from '@chain-factory/shared';
import { scoreFromString, type PartId } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { applyMigrations, openNodeSqlite } from '../src/adapters/nodeSqlite';
import { createDrizzleRepositories } from '../src/repositories/drizzle';
import { createMemoryRepositories } from '../src/repositories/memory';
import type { BestRecord, Repositories, WeekRecord } from '../src/repositories/types';

const implementations: [string, () => Repositories][] = [
  ['memory', createMemoryRepositories],
  [
    'drizzle(sqlite)',
    () => {
      const { db, raw } = openNodeSqlite();
      applyMigrations(raw);
      return createDrizzleRepositories(db);
    },
  ],
];

const WEEK = '2026-09-28';
const DAY = '2026-10-01';

async function addPlayer(repos: Repositories, id: string, hidden = false) {
  await repos.players.create({
    id,
    tokenHash: 'h',
    displayName: `P${id}`,
    hidden,
    createdAt: 0,
    registeredIpHash: null,
  });
}

function best(
  playerId: string,
  shiftsCleared: number,
  score: string,
  submittedAt: number,
): BestRecord {
  return {
    weekId: WEEK,
    dayId: DAY,
    playerId,
    shiftsCleared,
    score: toScoreColumns(scoreFromString(score)),
    maxChain: 1,
    submittedAt,
    daysPlayed: 1,
  };
}

describe.each(implementations)('repositories: %s', (_name, create) => {
  it('外部 ID の対応: 同じ外部 ID は1人だけ・トークンの発行し直し', async () => {
    const repos = create();
    await addPlayer(repos, 'a');
    const record = { provider: 'steam' as const, subjectHash: 'x', playerId: 'a', createdAt: 1 };
    expect(await repos.externalAccounts.findPlayerId('steam', 'x')).toBeNull();
    expect(await repos.externalAccounts.create(record)).toBe(true);
    expect(await repos.externalAccounts.create({ ...record, playerId: 'b' })).toBe(false);
    expect(await repos.externalAccounts.findPlayerId('steam', 'x')).toBe('a');
    await repos.players.updateTokenHash('a', 'new-hash');
    expect((await repos.players.findById('a'))?.tokenHash).toBe('new-hash');
  });

  it('プレイヤーの作成・取得・名前変更', async () => {
    const repos = create();
    await addPlayer(repos, 'a');
    await repos.players.updateName('a', 'ボルト');
    expect(await repos.players.findById('a')).toMatchObject({
      displayName: 'ボルト',
      hidden: false,
    });
    expect(await repos.players.findById('zz')).toBeNull();
  });

  it('週は「なければ作る」（2回目は上書きしない）・変わる項目を書き戻せる', async () => {
    const repos = create();
    const base: WeekRecord = {
      id: WEEK,
      number: 1,
      candidate: 0,
      fallback: false,
      verifyState: 'pending',
      verifySamples: [],
      baseConfig: { x: 1 } as never,
      config: null,
      marketState: 'pending',
      seedCommitment: 'c1',
      simVersion: '1',
      opensAt: 0,
      closesAt: 1,
    };
    await repos.weeks.createIfAbsent(base);
    await repos.weeks.createIfAbsent({ ...base, seedCommitment: 'c2' });
    expect(await repos.weeks.find(WEEK)).toEqual(base);
    const saved: WeekRecord = {
      ...base,
      candidate: 1,
      verifyState: 'verified',
      verifySamples: [{ candidate: 0, sample: 0, started: true, cleared: false }],
      config: { y: 2 } as never,
      marketState: 'base',
    };
    await repos.weeks.save(saved);
    expect(await repos.weeks.find(WEEK)).toEqual(saved);
  });

  it('挑戦は1日1回（2回目の作成は失敗）・進行状況が一致するときだけ更新・古い週を消す', async () => {
    const repos = create();
    const s = {
      weekId: WEEK,
      dayId: DAY,
      playerId: 'a',
      ops: [],
      shiftIndex: 0,
      status: 'playing' as const,
      startedAt: 0,
      updatedAt: 0,
    };
    expect(await repos.attempts.create(s)).toBe(true);
    expect(await repos.attempts.create(s)).toBe(false);
    expect(await repos.attempts.create({ ...s, dayId: '2026-10-02' })).toBe(true);
    const next = { ...s, ops: [[{ op: 'reroll' as const }]], shiftIndex: 1 };
    expect(await repos.attempts.update(next, 0)).toBe(true);
    // 同じシフトをもう一度確定しようとしても失敗する
    expect(await repos.attempts.update({ ...next, shiftIndex: 2 }, 0)).toBe(false);
    expect(await repos.attempts.find(WEEK, DAY, 'a')).toMatchObject({ shiftIndex: 1 });
    expect((await repos.attempts.listByPlayer(WEEK, 'a')).map((x) => x.dayId)).toEqual([
      DAY,
      '2026-10-02',
    ]);
    expect(await repos.attempts.deleteWeeksBefore(WEEK)).toBe(0);
    expect(await repos.attempts.deleteWeeksBefore('2026-10-05')).toBe(2);
    expect(await repos.attempts.find(WEEK, DAY, 'a')).toBeNull();
  });

  it('ベスト: 並び順・非表示のプレイヤーの除外が compareRankKey と一致する', async () => {
    const repos = create();
    // 先頭15桁が同じで末尾だけ違う巨大スコア・同点の提出時刻違いなどを混ぜる
    const rows = [
      best('a', 3, '1000', 5),
      best('b', 3, '1000', 3),
      best('c', 2, '999999999999999999', 1),
      best('d', 3, '1234567890123456789', 9),
      best('e', 3, '1234567890123456788', 1),
      best('f', 3, '99', 1),
      best('g', 1, '0', 1),
      best('h', 3, '5000', 1),
    ];
    for (const r of rows) {
      await addPlayer(repos, r.playerId, r.playerId === 'h');
      await repos.bests.put(r);
    }
    const all = [...rows].sort(compareRankKey).map((r) => r.playerId);
    const visible = all.filter((id) => id !== 'h');

    expect(await repos.bests.count(WEEK)).toBe(visible.length);
    expect((await repos.bests.listRanked(WEEK)).map((r) => r.playerId)).toEqual(visible);
    expect((await repos.bests.listRanked(WEEK))[0]?.displayName).toBe(`P${visible[0]}`);
    expect((await repos.bests.listAll(WEEK)).map((r) => r.playerId)).toEqual(all);
  });

  it('ベストの上書き（同じプレイヤーの更新）', async () => {
    const repos = create();
    await addPlayer(repos, 'a');
    await repos.bests.put(best('a', 1, '10', 1));
    await repos.bests.put({ ...best('a', 2, '20', 2), daysPlayed: 2 });
    expect(await repos.bests.find(WEEK, 'a')).toMatchObject({
      shiftsCleared: 2,
      score: { text: '20' },
      daysPlayed: 2,
    });
    expect(await repos.bests.count(WEEK)).toBe(1);
  });

  it('確定順位: まとめて書く（上書き）・順位の範囲で読む・表示名と非表示を付ける・古い週を消す', async () => {
    const repos = create();
    const standings = Array.from({ length: 120 }, (_, i) => ({
      ...best(`p${i}`, 3, String(1000 - i), i),
      rank: i + 1,
      topPercentMilli: (i + 1) * 1000,
    }));
    for (const r of standings) await addPlayer(repos, r.playerId, r.playerId === 'p1');
    await repos.standings.putMany(standings);
    await repos.standings.putMany(standings.slice(0, 2).map((r) => ({ ...r, daysPlayed: 3 })));
    const page = await repos.standings.list(WEEK, 1, 3);
    expect(page.map((r) => [r.rank, r.playerId, r.hidden])).toEqual([
      [1, 'p0', false],
      [2, 'p1', true],
      [3, 'p2', false],
    ]);
    expect(page[0]).toMatchObject({ displayName: 'Pp0', daysPlayed: 3, score: { text: '1000' } });
    expect((await repos.standings.list(WEEK, 119, 10)).map((r) => r.rank)).toEqual([119, 120]);
    expect(await repos.standings.find(WEEK, 'p5')).toMatchObject({ rank: 6 });
    expect(await repos.standings.deleteWeeksBefore('2026-10-05')).toBe(120);
    expect(await repos.standings.find(WEEK, 'p5')).toBeNull();
  });

  it('確定の進み具合・確定済みの週の一覧（新しい順）', async () => {
    const repos = create();
    expect(await repos.finalizations.find(WEEK)).toBeNull();
    await repos.finalizations.save({ weekId: WEEK, total: 3, processed: 1, finishedAt: null });
    await repos.finalizations.save({ weekId: '2026-09-21', total: 0, processed: 0, finishedAt: 5 });
    expect(await repos.finalizations.listFinished(5)).toEqual(['2026-09-21']);
    await repos.finalizations.save({ weekId: WEEK, total: 3, processed: 3, finishedAt: 9 });
    expect(await repos.finalizations.find(WEEK)).toEqual({
      weekId: WEEK,
      total: 3,
      processed: 3,
      finishedAt: 9,
    });
    expect(await repos.finalizations.listFinished(5)).toEqual([WEEK, '2026-09-21']);
    expect(await repos.finalizations.listFinished(1)).toEqual([WEEK]);
  });

  it('ショップ統計は加算される・相場は週ごと', async () => {
    const repos = create();
    const gear = 'gear' as PartId;
    await repos.shopStats.add(WEEK, [{ partId: gear, offered: 3, bought: 1 }]);
    await repos.shopStats.add(WEEK, [{ partId: gear, offered: 2, bought: 2 }]);
    expect(await repos.shopStats.get(WEEK)).toEqual([{ partId: gear, offered: 5, bought: 3 }]);

    expect(await repos.market.get(WEEK)).toBeNull();
    await repos.market.put(WEEK, [{ partId: gear, multiplierMilli: 1200, price: 5 }]);
    await repos.market.put(WEEK, [{ partId: gear, multiplierMilli: 800, price: 3 }]);
    expect(await repos.market.get(WEEK)).toEqual([
      { partId: gear, multiplierMilli: 800, price: 3 },
    ]);
  });
});
