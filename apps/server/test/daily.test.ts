/**
 * デイリーの API テスト: 取得 → 開始 → 本番（サーバー検証）→ ランキング → 秘密値の公開
 * 不正な提出（予算オーバー・ショップにないパーツ・盤面外・sim のバージョン違い）が拒否されることも確かめる。
 */
import {
  commitShift,
  createRunWithConfig,
  dailyRunSeed,
  getCurrentFloor,
  getCurrentRules,
  isBlockedCell,
  PART_IDS,
  SIM_VERSION,
  replayOps,
  scoreToString,
  simulate,
  type RunConfig,
  type RunOp,
  type RunState,
} from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { memoryRateLimiter } from '../src/adapters/rateLimiter';
import { fromHex, sha256Hex } from '../src/domain/crypto';
import { applyMigrations, openNodeSqlite } from '../src/adapters/nodeSqlite';
import type { DomainContext } from '../src/domain/context';
import { ensureDaily } from '../src/domain/daily/dailyJob';
import { createDrizzleRepositories } from '../src/repositories/drizzle';
import { createMemoryRepositories } from '../src/repositories/memory';
import { DAY, NOON, REGISTER_BODY, testApi, testContext } from './helpers';

/** スイッチ → 出荷口 の最小の盤面（どのシードでも出荷量 1） */
const SIMPLE_OPS: RunOp[] = [
  { op: 'place', partId: 'switch', x: 1, y: 3, dir: 1 },
  { op: 'place', partId: 'dock', x: 2, y: 3, dir: 0 },
];

/**
 * テスト用に、ノルマ 1・特殊ルールなし・ボスなしのデイリーを登録する
 * （盤面の作り方に迷わず、3シフトを通しで検証できるようにするため）
 */
async function seedEasyDaily(ctx: DomainContext): Promise<RunConfig> {
  const scratch = { ...ctx, repos: createMemoryRepositories() };
  const real = await ensureDaily(scratch, DAY);
  const config: RunConfig = {
    ...real.config,
    shifts: real.config.shifts.map((s) => ({ ...s, quota: 1, kind: 'normal' as const })),
    bossPlan: real.config.bossPlan.map(() => null),
    globalModifier: null,
  };
  await ctx.repos.dailies.createIfAbsent({ ...real, config });
  return config;
}

/** クライアント側の再現: 操作ログを適用し、サーバーから返ったシードで本番を実行する */
function clientCommit(state: RunState, ops: RunOp[], seed: number) {
  const replayed = replayOps(state, ops);
  if (!replayed.ok) throw new Error(replayed.error);
  const committed = commitShift(replayed.state, { seed });
  if ('error' in committed) throw new Error(committed.error);
  return committed;
}

describe('デイリー: 通しのプレイ', () => {
  it('取得 → 開始 → 3シフト本番 → ランキング。サーバーとクライアントの結果が一致する', async () => {
    const { ctx } = testContext();
    const config = await seedEasyDaily(ctx);
    const api = testApi(ctx);
    const { token } = await api.register();

    const today = await api.call('GET', '/daily/today');
    expect(today.status).toBe(200);
    expect(today.json.dailyId).toBe(DAY);
    expect(today.json.config).toEqual(config);

    expect((await api.call('POST', `/daily/${DAY}/start`, {}, token)).status).toBe(200);

    let state = createRunWithConfig(dailyRunSeed(DAY), config);
    for (let shift = 0; shift < 3; shift++) {
      const ops = shift === 0 ? SIMPLE_OPS : [];
      const res = await api.commit(token, shift, ops);
      expect(res.status).toBe(200);
      expect(res.json).toMatchObject({ cleared: true, finished: shift === 2 });
      // 決定論: 返ってきたシードでクライアントが計算しても、サーバーと同じ出荷量になる
      const local = clientCommit(state, ops, res.json.seed as number);
      expect(scoreToString(local.result.score)).toBe(res.json.score);
      state = local.state;
    }

    // 終わった後はもう本番できない
    expect((await api.commit(token, 3, [])).status).toBe(400);

    const ranking = await api.call('GET', `/daily/${DAY}/ranking`, undefined, token);
    expect(ranking.json).toMatchObject({
      total: 1,
      me: { rank: 1, topPercent: 100 },
      top: [{ rank: 1, shiftsCleared: 3, score: '3', isMe: true }],
    });
  });

  it('途中で閉じても、確定済みの操作ログとシードで再開できる', async () => {
    const { ctx } = testContext();
    const config = await seedEasyDaily(ctx);
    const api = testApi(ctx);
    const { token } = await api.register();
    await api.call('POST', `/daily/${DAY}/start`, {}, token);
    const first = await api.commit(token, 0, SIMPLE_OPS);

    const session = await api.call('GET', `/daily/${DAY}/session`, undefined, token);
    expect(session.json).toMatchObject({
      ops: [SIMPLE_OPS],
      commitSeeds: [first.json.seed],
      status: 'playing',
    });

    // 返ってきた情報だけでクライアントの状態を作り直し、続きを本番できる
    const resumed = clientCommit(
      createRunWithConfig(dailyRunSeed(DAY), config),
      SIMPLE_OPS,
      first.json.seed as number,
    );
    expect(resumed.state.shiftIndex).toBe(1);
    expect((await api.commit(token, 1, [])).status).toBe(200);
  });

  it('1日1回: 2回目の開始は alreadyPlayed', async () => {
    const { ctx } = testContext();
    await seedEasyDaily(ctx);
    const api = testApi(ctx);
    const { token } = await api.register();
    expect((await api.call('POST', `/daily/${DAY}/start`, {}, token)).status).toBe(200);
    const again = await api.call('POST', `/daily/${DAY}/start`, {}, token);
    expect(again).toEqual({ status: 409, json: { error: 'alreadyPlayed' } });
  });

  it('本物の設定（生成ジョブ・特殊ルールあり）でも D1 と同じ SQLite 上で通しで動く', async () => {
    const { db, raw } = openNodeSqlite();
    applyMigrations(raw);
    const { ctx } = testContext(createDrizzleRepositories(db));
    const api = testApi(ctx);
    const { token } = await api.register();
    const today = await api.call('GET', '/daily/today');
    const config = today.json.config as RunConfig;
    await api.call('POST', `/daily/${DAY}/start`, {}, token);

    // 特殊ルールで使えないマスを避けて置く
    // 床（ステージ・特殊ルールの使用不可・ボーナス床）のない行に置く
    const floor = getCurrentFloor(createRunWithConfig(dailyRunSeed(DAY), config));
    const y = [3, 2, 4, 1, 5].find((row) => !floor[row * 7 + 1] && !floor[row * 7 + 2])!;
    const ops: RunOp[] = SIMPLE_OPS.map((op) => ({ ...op, y }) as RunOp);
    const res = await api.commit(token, 0, ops);
    expect(res.status).toBe(200);
    const local = clientCommit(
      createRunWithConfig(dailyRunSeed(DAY), config),
      ops,
      res.json.seed as number,
    );
    expect(scoreToString(local.result.score)).toBe(res.json.score);

    const ranking = await api.call('GET', `/daily/${DAY}/ranking`, undefined, token);
    expect(ranking.json.total).toBe(1);
  });
});

describe('デイリー: 不正な提出の拒否', () => {
  async function setup() {
    const { ctx, clock } = testContext();
    await seedEasyDaily(ctx);
    const api = testApi(ctx);
    const { token } = await api.register();
    await api.call('POST', `/daily/${DAY}/start`, {}, token);
    return { ctx, clock, api, token };
  }
  const invalid = { status: 400, json: { error: 'invalidSubmission' } };

  it('予算オーバー（リロールし続ける）', async () => {
    const { api, token } = await setup();
    const ops: RunOp[] = Array.from({ length: 30 }, () => ({ op: 'reroll' }));
    expect(await api.commit(token, 0, ops)).toEqual(invalid);
  });

  it('ショップにない商品の購入・手持ちにないパーツの配置', async () => {
    const { api, token } = await setup();
    expect(await api.commit(token, 0, [{ op: 'buy', offerIndex: 99 }])).toEqual(invalid);
    expect(
      await api.commit(token, 0, [{ op: 'place', partId: 'barrel', x: 0, y: 0, dir: 0 }]),
    ).toEqual(invalid);
  });

  it('盤面外への配置', async () => {
    const { api, token } = await setup();
    expect(
      await api.commit(token, 0, [{ op: 'place', partId: 'dock', x: 7, y: 0, dir: 0 }]),
    ).toEqual(invalid);
    expect(
      await api.commit(token, 0, [{ op: 'place', partId: 'dock', x: -1, y: 0, dir: 0 }]),
    ).toEqual(invalid);
  });

  it('壊れた操作・操作ログでないもの', async () => {
    const { api, token } = await setup();
    expect(await api.commit(token, 0, [{ op: 'teleport' } as never])).toEqual(invalid);
    expect(await api.commit(token, 0, 'hello' as never)).toEqual(invalid);
    expect(
      await api.commit(token, 0, [
        { op: 'place', partId: 'unknown-part', x: 0, y: 0, dir: 0 } as never,
      ]),
    ).toEqual(invalid);
    expect(
      await api.call(
        'POST',
        `/daily/${DAY}/commit`,
        { simVersion: SIM_VERSION, shiftIndex: 0 },
        token,
      ),
    ).toEqual(invalid);
  });

  it('シフト番号は安全な非負整数に限る', async () => {
    const { api, token } = await setup();
    expect(
      await api.call(
        'POST',
        `/daily/${DAY}/commit`,
        { simVersion: SIM_VERSION, shiftIndex: Number.MAX_SAFE_INTEGER + 1, ops: [] },
        token,
      ),
    ).toEqual({ status: 400, json: { error: 'badRequest' } });
  });

  it('sim のバージョン違い', async () => {
    const { api, token } = await setup();
    expect(await api.commit(token, 0, SIMPLE_OPS, '0')).toEqual({
      status: 409,
      json: { error: 'simVersionMismatch' },
    });
  });

  it('シフト番号の食い違い・拒否された後は正しい提出がそのまま通る', async () => {
    const { api, token } = await setup();
    expect((await api.commit(token, 1, SIMPLE_OPS)).status).toBe(400);
    expect((await api.commit(token, 0, [{ op: 'buy', offerIndex: 99 }])).status).toBe(400);
    expect((await api.commit(token, 0, SIMPLE_OPS)).status).toBe(200);
  });

  it('締め切り後は本番できない', async () => {
    const { api, token, clock } = await setup();
    clock.now = NOON + 24 * 60 * 60 * 1000;
    expect(await api.commit(token, 0, SIMPLE_OPS)).toEqual({
      status: 410,
      json: { error: 'dailyClosed' },
    });
  });

  it('認証なし・偽のトークン', async () => {
    const { api, token } = await setup();
    expect((await api.commit('', 0, SIMPLE_OPS)).status).toBe(401);
    const forged = token.replace(/\.[0-9a-f]+$/, '.' + '0'.repeat(48));
    expect((await api.commit(forged, 0, SIMPLE_OPS)).status).toBe(401);
  });
});

describe('デイリー: シードの公開と照合', () => {
  it('締め切り前は非公開。締め切り後に公開された秘密値は開始時の seedCommitment と一致する', async () => {
    const { ctx, clock } = testContext();
    const api = testApi(ctx);
    const today = await api.call('GET', '/daily/today');
    expect((await api.call('GET', `/daily/${DAY}/reveal`)).status).toBe(404);

    clock.now = NOON + 24 * 60 * 60 * 1000;
    const reveal = await api.call('GET', `/daily/${DAY}/reveal`);
    expect(reveal.status).toBe(200);
    expect(await sha256Hex(fromHex(reveal.json.dailySecret as string))).toBe(
      today.json.seedCommitment,
    );
  });

  it('未来のデイリーは取得できない', async () => {
    const { ctx } = testContext();
    const api = testApi(ctx);
    expect((await api.call('GET', '/daily/2026-10-02/ranking')).status).toBe(200);
    expect((await api.call('POST', '/daily/2026-10-02/start')).status).toBe(401);
    const { token } = await api.register();
    expect((await api.call('POST', '/daily/2026-10-02/start', {}, token)).status).toBe(404);
  });
});

describe('プレイヤー・レート制限', () => {
  it('表示名: 全角英数は半角にそろえ、長すぎる名前・NG ワード・記号は拒否', async () => {
    const { ctx } = testContext();
    const api = testApi(ctx);
    const { token } = await api.register();
    const put = (displayName: unknown) =>
      api.call('PUT', '/players/me/name', { displayName }, token);
    expect((await put('ＢＯＬＴ　１号')).json).toEqual({ displayName: 'BOLT 1号' });
    expect((await put('あ'.repeat(13))).status).toBe(400);
    expect((await put('公式ボルト')).status).toBe(400);
    expect((await put('<script>')).status).toBe(400);
    expect((await put(42)).status).toBe(400);
  });

  it('登録時に表示名が自動でつく', async () => {
    const { ctx } = testContext();
    const res = await testApi(ctx).call('POST', '/players', REGISTER_BODY);
    expect(res.json.displayName).toMatch(/^Bolt-[0-9a-f]{4}$/);
  });

  it('書き込みはプレイヤー単位でも制限される（IP を変えても同じ人なら 429）', async () => {
    const { ctx } = testContext();
    await seedEasyDaily(ctx);
    const limiter = memoryRateLimiter(2, 60_000, () => NOON);
    const api = testApi(ctx, { write: limiter });
    const { token } = await api.register(); // IP 'unknown' の枠を1つ使う
    const put = (ip: string) =>
      testApi(ctx, { write: limiter }).call(
        'PUT',
        '/players/me/name',
        { displayName: ip },
        token,
        ip,
      );
    expect((await put('ip1')).status).toBe(200);
    expect((await put('ip2')).status).toBe(200);
    expect((await put('ip3')).json).toEqual({ error: 'rateLimited' });
  });

  it('書き込みの上限を超えると 429', async () => {
    const { ctx } = testContext();
    const api = testApi(ctx, { write: memoryRateLimiter(2, 60_000, () => NOON) });
    expect((await api.call('POST', '/players', REGISTER_BODY)).status).toBe(200);
    expect((await api.call('POST', '/players', REGISTER_BODY)).status).toBe(200);
    expect(await api.call('POST', '/players', REGISTER_BODY)).toEqual({
      status: 429,
      json: { error: 'rateLimited' },
    });
  });
});

describe('床タイル（SIM_VERSION 5）', () => {
  it('配布された RunConfig にその日のステージがあり、床の上の出荷口の出荷量がサーバーとクライアントで一致する', async () => {
    const { ctx } = testContext();
    const config = await seedEasyDaily(ctx);
    expect(config.stages?.days).toHaveLength(1);
    const api = testApi(ctx);
    const { token } = await api.register();
    expect((await api.call('POST', `/daily/${DAY}/start`, {}, token)).status).toBe(200);

    // 効果のある床（ステージ・ボーナス床）のマスに出荷口、その左にスイッチを置く
    const state = createRunWithConfig(dailyRunSeed(DAY), config);
    const floor = getCurrentFloor(state);
    const index = floor.findIndex(
      (c, i) => c && !isBlockedCell(floor, i) && i % 7 > 0 && !floor[i - 1],
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const x = index % 7;
    const y = Math.floor(index / 7);
    const ops: RunOp[] = [
      { op: 'place', partId: 'switch', x: x - 1, y, dir: 1 },
      { op: 'place', partId: 'dock', x, y, dir: 0 },
    ];
    const res = await api.commit(token, 0, ops);
    expect(res.status).toBe(200);
    const local = clientCommit(state, ops, res.json.seed as number);
    expect(scoreToString(local.result.score)).toBe(res.json.score);
    // 床の効果で 1 より大きくなる
    expect(BigInt(res.json.score as string) > 1n).toBe(true);
    expect(local.result.events.some((e) => e.type === 'floor')).toBe(true);
  });

  it('使用不可の床のマスへの配置は、サーバーの検証で拒否される', async () => {
    const { ctx } = testContext();
    const config = await seedEasyDaily(ctx);
    const api = testApi(ctx);
    const { token } = await api.register();
    await api.call('POST', `/daily/${DAY}/start`, {}, token);
    const floor = getCurrentFloor(createRunWithConfig(dailyRunSeed(DAY), config));
    const blocked = floor.findIndex((_, i) => isBlockedCell(floor, i));
    // デイリーの帯（2日目相当）のテンプレートには、どれも使用不可がある
    expect(blocked).toBeGreaterThanOrEqual(0);
    const ops: RunOp[] = [
      { op: 'place', partId: 'dock', x: blocked % 7, y: Math.floor(blocked / 7), dir: 0 },
    ];
    expect((await api.commit(token, 0, ops)).status).toBe(400);
  });

  it('床の導入前（SIM_VERSION 4）に生成されたデイリーへの提出は拒否される', async () => {
    const { ctx } = testContext();
    const scratch = { ...ctx, repos: createMemoryRepositories() };
    const real = await ensureDaily(scratch, DAY);
    expect(real.simVersion).toBe(SIM_VERSION);
    await ctx.repos.dailies.createIfAbsent({ ...real, simVersion: '4' });
    const api = testApi(ctx);
    const { token } = await api.register();
    await api.call('POST', `/daily/${DAY}/start`, {}, token);
    expect(await api.commit(token, 0, SIMPLE_OPS)).toEqual({
      status: 409,
      json: { error: 'simVersionMismatch' },
    });
  });
});

describe('ランダム配置権（SIM_VERSION 6）', () => {
  it('ショップで買って使う操作ログがサーバーで検証され、湧いた床の結果がクライアントと一致する。相場の集計に入らない', async () => {
    const { ctx } = testContext();
    // 配置権が必ず並ぶようにしたデイリー
    const scratch = { ...ctx, repos: createMemoryRepositories() };
    const real = await ensureDaily(scratch, DAY);
    const config: RunConfig = {
      ...real.config,
      shifts: real.config.shifts.map((s) => ({ ...s, quota: 1, kind: 'normal' as const })),
      bossPlan: real.config.bossPlan.map(() => null),
      globalModifier: null,
      floorPermit: { ...real.config.floorPermit!, offerChancePercent: 100 },
    };
    await ctx.repos.dailies.createIfAbsent({ ...real, config });
    const api = testApi(ctx);
    const { token } = await api.register();
    expect((await api.call('POST', `/daily/${DAY}/start`, {}, token)).status).toBe(200);

    const state = createRunWithConfig(dailyRunSeed(DAY), config);
    const offerIndex = state.shop.findIndex((o) => o.itemId === 'floorPermit');
    expect(offerIndex).toBeGreaterThanOrEqual(0);
    const bought = replayOps(state, [
      { op: 'buy', offerIndex },
      { op: 'useItem', itemId: 'floorPermit' },
    ]);
    if (!bought.ok) throw new Error(String(bought.error));
    // 湧いた床の左にスイッチ、床の上に出荷口（盤面の左端なら右にずらす）
    const floor = getCurrentFloor(bought.state);
    const cell = bought.state.itemFloors!.cells[0]!;
    const x = cell.index % 7;
    const y = Math.floor(cell.index / 7);
    const sx = x > 0 && !floor[cell.index - 1] ? x - 1 : x + 1;
    const ops: RunOp[] = [
      { op: 'buy', offerIndex },
      { op: 'useItem', itemId: 'floorPermit' },
      { op: 'place', partId: 'switch', x: sx, y, dir: sx < x ? 1 : 3 },
      { op: 'place', partId: 'dock', x, y, dir: 0 },
    ];
    const res = await api.commit(token, 0, ops);
    expect(res.status).toBe(200);
    const local = clientCommit(state, ops, res.json.seed as number);
    expect(scoreToString(local.result.score)).toBe(res.json.score);
    expect(local.result.events.some((e) => e.type === 'floor')).toBe(true);
    // 相場の集計（パーツごと）に配置権は入らない
    const stats = await ctx.repos.shopStats.get(DAY);
    expect(stats.length).toBeGreaterThan(0);
    expect(stats.every((row) => PART_IDS.includes(row.partId))).toBe(true);
  });

  it('知らない消耗品を使う操作は拒否される', async () => {
    const { ctx } = testContext();
    await seedEasyDaily(ctx);
    const api = testApi(ctx);
    const { token } = await api.register();
    await api.call('POST', `/daily/${DAY}/start`, {}, token);
    const ops = [{ op: 'useItem', itemId: 'lava' } as never];
    expect((await api.commit(token, 0, ops)).status).toBe(400);
    // 持っていない配置権を使う操作も拒否される
    expect((await api.commit(token, 0, [{ op: 'useItem', itemId: 'floorPermit' }])).status).toBe(
      400,
    );
  });
});

describe('ゴールデンデータ（秘密値・本番シード・出荷量の導出が変わっていないこと）', () => {
  it('固定のマスター鍵・日付・盤面から常に同じ値になる', async () => {
    const { ctx } = testContext();
    const api = testApi(ctx);
    const today = await api.call('GET', '/daily/today');
    const { token } = await api.register();
    await api.call('POST', `/daily/${DAY}/start`, {}, token);
    const config = today.json.config as RunConfig;
    const blocked = new Set(config.globalModifier?.blockedCells ?? []);
    const y = [3, 2, 4, 1, 5].find(
      (row) => !blocked.has(row * 7 + 1) && !blocked.has(row * 7 + 2),
    )!;
    const ops: RunOp[] = SIMPLE_OPS.map((op) => ({ ...op, y }) as RunOp);
    const res = await api.commit(token, 0, ops);

    // 値が変わったら「導出方法を変えた」ということ。意図した変更なら SIM_VERSION を上げてから更新する
    expect({
      seedCommitment: today.json.seedCommitment,
      seed: res.json.seed,
      score: res.json.score,
    }).toMatchInlineSnapshot(`
      {
        "score": "1",
        "seed": 795447127,
        "seedCommitment": "196ea82936392d1bd8b2aef013cd3c0c5480d20c0dcdf6f61b6d5a9ba66d5c3c",
      }
    `);
    // クライアントの simulate 単体でも同じ出荷量
    const replayed = replayOps(createRunWithConfig(dailyRunSeed(DAY), config), ops);
    if (!replayed.ok) throw new Error('replay failed');
    const direct = simulate({
      board: replayed.state.board,
      floor: getCurrentFloor(replayed.state),
      seed: res.json.seed as number,
      rules: getCurrentRules(replayed.state),
    });
    expect(scoreToString(direct.score)).toBe(res.json.score);
  });
});
