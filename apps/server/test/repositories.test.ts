/**
 * リポジトリ層のテスト
 * 同じテストをメモリ実装と Drizzle（node:sqlite）実装の両方に流し、振る舞いが同じことを確かめる。
 */
import { compareRankKey, toScoreColumns, type RankKey } from '@chain-factory/shared';
import { scoreFromString, type PartId } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { applyMigrations, openNodeSqlite } from '../src/adapters/nodeSqlite';
import { createDrizzleRepositories } from '../src/repositories/drizzle';
import { createMemoryRepositories } from '../src/repositories/memory';
import type { Repositories, ResultRecord } from '../src/repositories/types';

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

function result(
  playerId: string,
  shiftsCleared: number,
  score: string,
  submittedAt: number,
): ResultRecord {
  return {
    dailyId: DAY,
    playerId,
    shiftsCleared,
    score: toScoreColumns(scoreFromString(score)),
    maxChain: 1,
    submittedAt,
  };
}

describe.each(implementations)('repositories: %s', (_name, create) => {
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

  it('デイリーは「なければ作る」（2回目は上書きしない）', async () => {
    const repos = create();
    const base = {
      id: DAY,
      number: 1,
      config: { x: 1 } as never,
      seedCommitment: 'c1',
      simVersion: '1',
      opensAt: 0,
      closesAt: 1,
    };
    await repos.dailies.createIfAbsent(base);
    await repos.dailies.createIfAbsent({ ...base, seedCommitment: 'c2' });
    expect((await repos.dailies.find(DAY))?.seedCommitment).toBe('c1');
    expect((await repos.dailies.find(DAY))?.config).toEqual({ x: 1 });
  });

  it('セッションは1日1回（2回目の作成は失敗）・進行状況が一致するときだけ更新', async () => {
    const repos = create();
    const s = {
      dailyId: DAY,
      playerId: 'a',
      ops: [],
      shiftIndex: 0,
      status: 'playing' as const,
      ranked: true,
      updatedAt: 0,
    };
    expect(await repos.sessions.create(s)).toBe(true);
    expect(await repos.sessions.create(s)).toBe(false);
    const next = { ...s, ops: [[{ op: 'reroll' as const }]], shiftIndex: 1 };
    expect(await repos.sessions.update(next, 0)).toBe(true);
    // 同じシフトをもう一度確定しようとしても失敗する
    expect(await repos.sessions.update({ ...next, shiftIndex: 2 }, 0)).toBe(false);
    expect(await repos.sessions.find(DAY, 'a')).toMatchObject({ shiftIndex: 1, ranked: true });
  });

  it('ランキング: 並び順・順位・非表示のプレイヤーの除外が compareRankKey と一致する', async () => {
    const repos = create();
    // 先頭15桁が同じで末尾だけ違う巨大スコア・同点の提出時刻違いなどを混ぜる
    const rows = [
      result('a', 3, '1000', 5),
      result('b', 3, '1000', 3),
      result('c', 2, '999999999999999999', 1),
      result('d', 3, '1234567890123456789', 9),
      result('e', 3, '1234567890123456788', 1),
      result('f', 3, '99', 1),
      result('g', 1, '0', 1),
      result('h', 3, '5000', 1),
    ];
    for (const r of rows) {
      await addPlayer(repos, r.playerId, r.playerId === 'h');
      await repos.results.put(r);
    }
    const visible = rows.filter((r) => r.playerId !== 'h');
    const expected = [...visible].sort(compareRankKey).map((r) => r.playerId);

    expect(await repos.results.count(DAY)).toBe(visible.length);
    expect((await repos.results.list(DAY, 0, 100)).map((r) => r.playerId)).toEqual(expected);
    expect((await repos.results.list(DAY, 2, 3)).map((r) => r.playerId)).toEqual(
      expected.slice(2, 5),
    );
    for (const [i, id] of expected.entries()) {
      const r = visible.find((v) => v.playerId === id)!;
      const key: RankKey = {
        shiftsCleared: r.shiftsCleared,
        score: r.score,
        submittedAt: r.submittedAt,
      };
      expect(await repos.results.countAbove(DAY, key)).toBe(i);
    }
  });

  it('結果の上書き（同じプレイヤーの再提出）', async () => {
    const repos = create();
    await addPlayer(repos, 'a');
    await repos.results.put(result('a', 1, '10', 1));
    await repos.results.put(result('a', 2, '20', 2));
    expect(await repos.results.find(DAY, 'a')).toMatchObject({
      shiftsCleared: 2,
      score: { text: '20' },
    });
    expect(await repos.results.count(DAY)).toBe(1);
  });

  it('ショップ統計は加算される・相場は日付ごと', async () => {
    const repos = create();
    const gear = 'gear' as PartId;
    await repos.shopStats.add(DAY, [{ partId: gear, offered: 3, bought: 1 }]);
    await repos.shopStats.add(DAY, [{ partId: gear, offered: 2, bought: 2 }]);
    expect(await repos.shopStats.get(DAY)).toEqual([{ partId: gear, offered: 5, bought: 3 }]);

    expect(await repos.market.get(DAY)).toBeNull();
    await repos.market.put(DAY, [{ partId: gear, multiplierMilli: 1200, price: 5 }]);
    await repos.market.put(DAY, [{ partId: gear, multiplierMilli: 800, price: 3 }]);
    expect(await repos.market.get(DAY)).toEqual([{ partId: gear, multiplierMilli: 800, price: 3 }]);
  });
});
