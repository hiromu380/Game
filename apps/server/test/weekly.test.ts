/**
 * 週替わりチャレンジの API テスト:
 * 今週の情報 → 今日の挑戦 → 本番（サーバー検証）→ 暫定ランキング → 結果の確定 → 結果発表・リプレイ・秘密値の公開
 * 1日1回・猶予・不正な提出（予算オーバー・ショップにないパーツ・盤面外・sim のバージョン違い）の拒否も確かめる。
 */
import { topPercent } from '@chain-factory/shared';
import {
  buildWeeklyConfig,
  commitShift,
  createRunWithConfig,
  getCurrentFloor,
  getCurrentRules,
  isBlockedCell,
  PART_IDS,
  SIM_VERSION,
  replayOps,
  scoreToString,
  simulate,
  weeklyRunSeed,
  type RunConfig,
  type RunOp,
  type RunState,
} from '@chain-factory/sim';
import { describe, expect, it, vi } from 'vitest';
import { memoryRateLimiter } from '../src/adapters/rateLimiter';
import { applyMigrations, openNodeSqlite } from '../src/adapters/nodeSqlite';
import { WEEKLY_CONFIG } from '../src/config/weekly';
import { fromHex, sha256Hex } from '../src/domain/crypto';
import type { DomainContext } from '../src/domain/context';
import { finalizeWeek } from '../src/domain/weekly/results';
import { ensureWeek } from '../src/domain/weekly/weeks';
import { createDrizzleRepositories } from '../src/repositories/drizzle';
import { DAY, DAY_MS, NOON, REGISTER_BODY, testApi, testContext, WEEK, WEEK_END } from './helpers';

/** スイッチ → 出荷口 の最小の盤面（どのシードでも出荷量 1） */
const SIMPLE_OPS: RunOp[] = [
  { op: 'place', partId: 'switch', x: 1, y: 3, dir: 1 },
  { op: 'place', partId: 'dock', x: 2, y: 3, dir: 0 },
];

/** その週のランシード（テストの週は候補 0） */
const runSeedOf = (weekId: string) => weeklyRunSeed(weekId, 0);

/**
 * テスト用に、ノルマ 1・特殊ルールなし・ボスなしの週を登録する
 * （盤面の作り方に迷わず、3シフトを通しで検証できるようにするため）
 */
async function seedEasyWeek(
  ctx: DomainContext,
  tweak: (c: RunConfig) => RunConfig = (c) => c,
): Promise<RunConfig> {
  const real = await ensureWeek(ctx, WEEK);
  // 検証を通った候補0の設定（相場なし）を、ノルマ1・ボスなし・特殊ルールなしにする
  const base = buildWeeklyConfig({ weekId: WEEK });
  const config = tweak({
    ...base,
    shifts: base.shifts.map((s) => ({ ...s, quota: 1, kind: 'normal' as const })),
    bossPlan: base.bossPlan.map(() => null),
    globalModifier: null,
  });
  await ctx.repos.weeks.save({ ...real, verifyState: 'verified', marketState: 'market', config });
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

/** 3シフトを通して遊ぶ（1シフト目にスイッチ → 出荷口、あとは何もしない） */
async function playAll(api: ReturnType<typeof testApi>, token: string, day = DAY) {
  for (let shift = 0; shift < 3; shift++) {
    const res = await api.commit(token, shift, shift === 0 ? SIMPLE_OPS : [], SIM_VERSION, day);
    if (res.status !== 200) throw new Error(JSON.stringify(res.json));
  }
}

/** プレイヤーを非表示にする（メモリのリポジトリは同じ ID の作成で上書きされる） */
async function hide(ctx: DomainContext, playerId: string) {
  const player = await ctx.repos.players.findById(playerId);
  await ctx.repos.players.create({ ...player!, hidden: true });
}

describe('週替わり: 通しのプレイ', () => {
  it('今週の情報 → 今日の挑戦 → 3シフト本番 → 暫定ランキング。サーバーとクライアントの結果が一致する', async () => {
    const { ctx } = testContext();
    const config = await seedEasyWeek(ctx);
    const api = testApi(ctx);
    const { token } = await api.register();

    const current = await api.call('GET', '/weekly/current', undefined, token);
    expect(current.status).toBe(200);
    expect(current.json).toMatchObject({
      weekId: WEEK,
      number: 1,
      today: DAY,
      candidate: 0,
      fallback: false,
      me: { best: null, days: [], today: 'none' },
    });
    expect(current.json.config).toEqual(config);

    const started = await api.start(token);
    expect(started.status).toBe(200);
    expect(started.json).toMatchObject({ attempt: { weekId: WEEK, dayId: DAY, ops: [] } });

    let state = createRunWithConfig(runSeedOf(WEEK), config);
    for (let shift = 0; shift < 3; shift++) {
      const ops = shift === 0 ? SIMPLE_OPS : [];
      const res = await api.commit(token, shift, ops);
      expect(res.status).toBe(200);
      expect(res.json).toMatchObject({ cleared: true, finished: shift === 2, newBest: true });
      // 決定論: 返ってきたシードでクライアントが計算しても、サーバーと同じ出荷量になる
      const local = clientCommit(state, ops, res.json.seed as number);
      expect(scoreToString(local.result.score)).toBe(res.json.score);
      state = local.state;
    }

    // 終わった後はもう本番できない
    expect((await api.commit(token, 3, [])).status).toBe(400);

    const ranking = await api.call('GET', `/weekly/${WEEK}/provisional`, undefined, token);
    expect(ranking.json).toMatchObject({
      provisional: true,
      total: 1,
      me: { rank: 1, topPercent: 100 },
      top: [{ rank: 1, shiftsCleared: 3, score: '3', isMe: true }],
    });
    const after = await api.call('GET', '/weekly/current', undefined, token);
    expect(after.json.me).toMatchObject({
      best: { dayId: DAY, shiftsCleared: 3, score: '3' },
      days: [{ dayId: DAY, status: 'finished', shiftsCleared: 3, score: '3' }],
      today: 'finished',
    });
  });

  it('途中で閉じても、確定済みの操作ログとシードで再開できる', async () => {
    const { ctx } = testContext();
    const config = await seedEasyWeek(ctx);
    const api = testApi(ctx);
    const { token } = await api.register();
    await api.start(token);
    const first = await api.commit(token, 0, SIMPLE_OPS);

    const attempt = await api.call('GET', `/weekly/${WEEK}/attempts/${DAY}`, undefined, token);
    expect(attempt.json).toMatchObject({
      ops: [SIMPLE_OPS],
      commitSeeds: [first.json.seed],
      status: 'playing',
    });

    // 返ってきた情報だけでクライアントの状態を作り直し、続きを本番できる
    const resumed = clientCommit(
      createRunWithConfig(runSeedOf(WEEK), config),
      SIMPLE_OPS,
      first.json.seed as number,
    );
    expect(resumed.state.shiftIndex).toBe(1);
    expect((await api.commit(token, 1, [])).status).toBe(200);
  });

  it('1日1回: 同じ日の2回目は alreadyPlayed、次の日はまた挑戦でき、本番シードは週の間同じ', async () => {
    const { ctx, clock } = testContext();
    await seedEasyWeek(ctx);
    const api = testApi(ctx);
    const { token } = await api.register();
    expect((await api.start(token)).status).toBe(200);
    expect(await api.start(token)).toEqual({ status: 409, json: { error: 'alreadyPlayed' } });
    const day1 = await api.commit(token, 0, SIMPLE_OPS);

    clock.now = NOON + DAY_MS;
    const next = await api.start(token);
    expect(next.status).toBe(200);
    expect(next.json).toMatchObject({ attempt: { dayId: '2026-10-02' } });
    const day2 = await api.commit(token, 0, SIMPLE_OPS, SIM_VERSION, '2026-10-02');
    expect(day2.json.seed).toBe(day1.json.seed);
  });

  it('同時に始めても1日1回（後から来た方は alreadyPlayed）', async () => {
    const { ctx } = testContext();
    await seedEasyWeek(ctx);
    const api = testApi(ctx);
    const { token } = await api.register();
    const results = await Promise.all([api.start(token), api.start(token), api.start(token)]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);
  });

  it('週のベスト: 複数の日のうち最良の挑戦が載り、参加日数を数える（同点は先に出した方）', async () => {
    const { ctx, clock } = testContext();
    await seedEasyWeek(ctx);
    const api = testApi(ctx);
    const { token, playerId } = await api.register();
    // 1日目: 1シフトだけ
    await api.start(token);
    await api.commit(token, 0, SIMPLE_OPS);
    // 2日目: 3シフト（こちらがベスト）
    clock.now = NOON + DAY_MS;
    await api.start(token);
    await playAll(api, token, '2026-10-02');
    // 3日目: 2日目と同じ成績（同点は先に出した2日目のまま）
    clock.now = NOON + 2 * DAY_MS;
    await api.start(token);
    await playAll(api, token, '2026-10-03');
    const best = await ctx.repos.bests.find(WEEK, playerId);
    expect(best).toMatchObject({ dayId: '2026-10-02', shiftsCleared: 3, daysPlayed: 3 });
  });

  it('本物の設定（先行生成・特殊ルールあり）でも D1 と同じ SQLite 上で通しで動く', async () => {
    const { db, raw } = openNodeSqlite();
    applyMigrations(raw);
    const { ctx } = testContext(createDrizzleRepositories(db));
    const api = testApi(ctx);
    const { token } = await api.register();
    const current = await api.call('GET', '/weekly/current');
    const config = current.json.config as RunConfig;
    const seed = weeklyRunSeed(
      WEEK,
      current.json.fallback ? -1 : (current.json.candidate as number),
    );
    await api.start(token);

    // 床（ステージ・特殊ルールの使用不可・ボーナス床）のない行に置く
    const floor = getCurrentFloor(createRunWithConfig(seed, config));
    const y = [3, 2, 4, 1, 5].find((row) => !floor[row * 7 + 1] && !floor[row * 7 + 2])!;
    const ops: RunOp[] = SIMPLE_OPS.map((op) => ({ ...op, y }) as RunOp);
    const res = await api.commit(token, 0, ops);
    expect(res.status).toBe(200);
    const local = clientCommit(createRunWithConfig(seed, config), ops, res.json.seed as number);
    expect(scoreToString(local.result.score)).toBe(res.json.score);

    const ranking = await api.call('GET', `/weekly/${WEEK}/provisional`, undefined, token);
    expect(ranking.json.total).toBe(1);
  });
});

describe('週替わり: 不正な提出の拒否', () => {
  async function setup() {
    const { ctx, clock } = testContext();
    await seedEasyWeek(ctx);
    const api = testApi(ctx);
    const { token } = await api.register();
    await api.start(token);
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
        `/weekly/${WEEK}/attempts/${DAY}/commit`,
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
        `/weekly/${WEEK}/attempts/${DAY}/commit`,
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

  it('その日の締め切り＋猶予を過ぎたら本番できない（猶予の内なら通る）', async () => {
    const { api, token, clock } = await setup();
    const dayEnd = Date.parse('2026-10-01T15:00:00Z');
    clock.now = dayEnd + WEEKLY_CONFIG.graceMs - 1;
    expect((await api.commit(token, 0, SIMPLE_OPS)).status).toBe(200);
    clock.now = dayEnd + WEEKLY_CONFIG.graceMs;
    expect(await api.commit(token, 1, [])).toEqual({
      status: 410,
      json: { error: 'challengeClosed' },
    });
  });

  it('認証なし・偽のトークン', async () => {
    const { api, token } = await setup();
    expect((await api.commit('', 0, SIMPLE_OPS)).status).toBe(401);
    const forged = token.replace(/\.[0-9a-f]+$/, '.' + '0'.repeat(48));
    expect((await api.commit(forged, 0, SIMPLE_OPS)).status).toBe(401);
  });
});

describe('週替わり: 暫定ランキング（当週）', () => {
  async function playersWithScores(n: number) {
    const { ctx, clock } = testContext();
    await seedEasyWeek(ctx);
    const api = testApi(ctx);
    const tokens: string[] = [];
    for (let i = 0; i < n; i++) {
      const { token } = await api.register();
      tokens.push(token);
      clock.now += 1000;
      await api.start(token);
      // i が大きいほどシフト数が多い（上位）
      for (let shift = 0; shift <= Math.min(i, 2); shift++) {
        await api.commit(token, shift, shift === 0 ? SIMPLE_OPS : []);
      }
    }
    return { ctx, clock, api, tokens };
  }

  it('順位・上位○%・参加人数・トップ。「暫定」であることを返し、他人の配置・操作ログは含めない', async () => {
    const { api, tokens } = await playersWithScores(3);
    const res = await api.call('GET', `/weekly/${WEEK}/provisional`, undefined, tokens[0]);
    expect(res.json).toMatchObject({
      provisional: true,
      total: 3,
      topMode: 'full',
      me: { rank: 3, topPercent: topPercent(3, 3) },
    });
    const top = res.json.top as Record<string, unknown>[];
    expect(top.map((e) => e.shiftsCleared)).toEqual([3, 2, 1]);
    const text = JSON.stringify(res.json);
    expect(text).not.toMatch(/ops|board|commitSeeds|config|playerId/);
  });

  it('並びはキャッシュの間隔だけ古くてもよいが、自分の順位は最新のベストで出す', async () => {
    const { ctx, api, tokens, clock } = await playersWithScores(2);
    const first = await api.call('GET', `/weekly/${WEEK}/provisional`, undefined, tokens[0]);
    expect(first.json.me).toMatchObject({ rank: 2 });
    // 新しい参加者（キャッシュの間は並びに入らない）
    const { token } = await api.register();
    await api.start(token);
    await playAll(api, token);
    const cached = await api.call('GET', `/weekly/${WEEK}/provisional`, undefined, tokens[0]);
    expect(cached.json.total).toBe(2);
    expect(cached.json.updatedAt).toBe(first.json.updatedAt);
    // 新しい参加者自身は、キャッシュより新しい成績でも自分の順位がわかる
    const mine = await api.call('GET', `/weekly/${WEEK}/provisional`, undefined, token);
    expect(mine.json.me).toMatchObject({ rank: 1 });
    expect(mine.json.total).toBe(3);
    // 間隔が過ぎると並びを作り直す
    clock.now += WEEKLY_CONFIG.provisional.cacheSeconds * 1000;
    const fresh = await api.call('GET', `/weekly/${WEEK}/provisional`, undefined, tokens[0]);
    expect(fresh.json.total).toBe(3);
    expect(await ctx.repos.bests.count(WEEK)).toBe(3);
  });

  it('参加者 0 人・ログインなし', async () => {
    const { ctx } = testContext();
    await seedEasyWeek(ctx);
    const res = await testApi(ctx).call('GET', `/weekly/${WEEK}/provisional`);
    expect(res.json).toMatchObject({ total: 0, top: [], around: [], me: null });
  });

  it('非表示のプレイヤーは並びに入らない', async () => {
    const { ctx, api, tokens, clock } = await playersWithScores(2);
    const top = (await ctx.repos.bests.listAll(WEEK))[0]!;
    await hide(ctx, top.playerId);
    clock.now += WEEKLY_CONFIG.provisional.cacheSeconds * 1000;
    const res = await api.call('GET', `/weekly/${WEEK}/provisional`, undefined, tokens[0]);
    expect(res.json).toMatchObject({ total: 1, me: { rank: 1 } });
  });

  it('過去週・未来週の暫定ランキングは取れない', async () => {
    const { ctx } = testContext();
    await seedEasyWeek(ctx);
    const api = testApi(ctx);
    expect((await api.call('GET', '/weekly/2026-09-21/provisional')).json).toEqual({
      error: 'notPublished',
    });
    expect((await api.call('GET', '/weekly/2026-10-05/provisional')).json).toEqual({
      error: 'notPublished',
    });
  });
});

describe('週替わり: 結果発表（確定）', () => {
  async function playedWeek() {
    const { ctx, clock } = testContext();
    await seedEasyWeek(ctx);
    const api = testApi(ctx);
    const tokens: string[] = [];
    for (let i = 0; i < 3; i++) {
      const { token } = await api.register();
      tokens.push(token);
      clock.now += 1000;
      await api.start(token);
      for (let shift = 0; shift <= i; shift++) {
        await api.commit(token, shift, shift === 0 ? SIMPLE_OPS : []);
      }
    }
    return { ctx, clock, api, tokens };
  }

  it('当週は notPublished、締め切り後の集計中は tallying、確定後に順位・参加日数・秘密値を返す', async () => {
    const { ctx, clock, api, tokens } = await playedWeek();
    expect((await api.call('GET', `/weekly/${WEEK}/results`)).json).toEqual({
      error: 'notPublished',
    });
    clock.now = WEEK_END + 1;
    expect((await api.call('GET', `/weekly/${WEEK}/results`)).json).toEqual({ error: 'tallying' });
    // 猶予＋余裕の前は確定しない
    expect(await finalizeWeek(ctx, WEEK)).toBe(false);
    clock.now = WEEK_END + WEEKLY_CONFIG.graceMs + WEEKLY_CONFIG.finalizeDelayMs;
    expect(await finalizeWeek(ctx, WEEK)).toBe(true);

    const res = await api.call('GET', `/weekly/${WEEK}/results`, undefined, tokens[0]);
    expect(res.json).toMatchObject({
      weekId: WEEK,
      provisional: false,
      total: 3,
      me: { rank: 3, topPercent: 100, shiftsCleared: 1, daysPlayed: 1 },
    });
    expect((res.json.top as unknown[]).length).toBe(3);
    const commitment = (await ctx.repos.weeks.find(WEEK))!.seedCommitment;
    expect(await sha256Hex(fromHex(res.json.weekSecret as string))).toBe(commitment);
    const latest = await api.call('GET', '/weekly/latest');
    expect(latest.json).toEqual({ finished: [WEEK] });
  });

  it('確定は何度実行しても同じ・少しずつ進めても同じ順位になる', async () => {
    const { ctx, clock } = await playedWeek();
    clock.now = WEEK_END + WEEKLY_CONFIG.graceMs + WEEKLY_CONFIG.finalizeDelayMs;
    expect(await finalizeWeek(ctx, WEEK)).toBe(true);
    const once = await ctx.repos.standings.list(WEEK, 1, 10);
    expect(await finalizeWeek(ctx, WEEK)).toBe(true);
    expect(await ctx.repos.standings.list(WEEK, 1, 10)).toEqual(once);
    expect(once.map((r) => r.rank)).toEqual([1, 2, 3]);
    expect(once.map((r) => r.shiftsCleared)).toEqual([3, 2, 1]);
  });

  it('確定後に非表示にしたプレイヤーは表示から外れる（順位は確定したまま）', async () => {
    const { ctx, clock, api, tokens } = await playedWeek();
    clock.now = WEEK_END + WEEKLY_CONFIG.graceMs + WEEKLY_CONFIG.finalizeDelayMs;
    await finalizeWeek(ctx, WEEK);
    const first = (await ctx.repos.standings.list(WEEK, 1, 1))[0]!;
    await hide(ctx, first.playerId);
    const res = await api.call('GET', `/weekly/${WEEK}/results`, undefined, tokens[0]);
    const top = res.json.top as { rank: number }[];
    expect(top.map((e) => e.rank)).toEqual([2, 3]);
  });

  it('リプレイ: 上位の挑戦の操作ログと本番シードで、出荷量を再現できる（当週は取れない）', async () => {
    const { ctx, clock, api } = await playedWeek();
    expect((await api.call('GET', `/weekly/${WEEK}/results/1/replay`)).json).toEqual({
      error: 'notPublished',
    });
    clock.now = WEEK_END + WEEKLY_CONFIG.graceMs + WEEKLY_CONFIG.finalizeDelayMs;
    await finalizeWeek(ctx, WEEK);
    const replay = await api.call('GET', `/weekly/${WEEK}/results/1/replay`);
    expect(replay.status).toBe(200);
    const { config, ops, commitSeeds } = replay.json as {
      config: RunConfig;
      ops: RunOp[][];
      commitSeeds: number[];
    };
    let state = createRunWithConfig(runSeedOf(WEEK), config);
    ops.forEach((shiftOps, i) => {
      state = clientCommit(state, shiftOps, commitSeeds[i]!).state;
    });
    expect(state.history.filter((h) => h.cleared)).toHaveLength(3);
    expect((await api.call('GET', `/weekly/${WEEK}/results/101/replay`)).status).toBe(400);
  });

  it('参加者 0 人の週もすぐに確定する', async () => {
    const { ctx, clock } = testContext();
    await seedEasyWeek(ctx);
    clock.now = WEEK_END + WEEKLY_CONFIG.graceMs + WEEKLY_CONFIG.finalizeDelayMs;
    expect(await finalizeWeek(ctx, WEEK)).toBe(true);
    const res = await testApi(ctx).call('GET', `/weekly/${WEEK}/results`);
    expect(res.json).toMatchObject({ total: 0, top: [], me: null });
  });
});

describe('週替わり: 週の境目', () => {
  it('週の最終日に始めた挑戦は、週の締め切り＋猶予まで提出できる。翌週は新しい週になる', async () => {
    const { ctx, clock } = testContext();
    await seedEasyWeek(ctx);
    const api = testApi(ctx);
    const { token } = await api.register();
    clock.now = WEEK_END - 60_000; // 日曜 23:59
    await api.start(token);
    clock.now = WEEK_END + WEEKLY_CONFIG.graceMs - 1;
    expect((await api.commit(token, 0, SIMPLE_OPS, SIM_VERSION, '2026-10-04')).status).toBe(200);
    clock.now = WEEK_END + WEEKLY_CONFIG.graceMs;
    expect((await api.commit(token, 1, [], SIM_VERSION, '2026-10-04')).json).toEqual({
      error: 'challengeClosed',
    });
    // 先週の ID では始められない
    expect((await api.start(token)).json).toEqual({ error: 'challengeClosed' });
    const current = await api.call('GET', '/weekly/current');
    expect(current.json).toMatchObject({ weekId: '2026-10-05', number: 2 });
  });

  it('未来の週では始められない', async () => {
    const { ctx } = testContext();
    const api = testApi(ctx);
    const { token } = await api.register();
    expect((await api.start(token, '2026-10-05')).status).toBe(404);
  });

  it('旧 API（デイリー）はアプリの更新を促す', async () => {
    const { ctx } = testContext();
    const res = await testApi(ctx).call('GET', '/daily/today');
    expect(res).toEqual({ status: 410, json: { error: 'clientOutdated' } });
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
    await seedEasyWeek(ctx);
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
  it('配布された RunConfig にその週のステージがあり、床の上の出荷口の出荷量がサーバーとクライアントで一致する', async () => {
    const { ctx } = testContext();
    const config = await seedEasyWeek(ctx);
    expect(config.stages?.days).toHaveLength(1);
    const api = testApi(ctx);
    const { token } = await api.register();
    expect((await api.start(token)).status).toBe(200);

    // 効果のある床（ステージ・ボーナス床）のマスに出荷口、その左にスイッチを置く
    const state = createRunWithConfig(runSeedOf(WEEK), config);
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
    const config = await seedEasyWeek(ctx);
    const api = testApi(ctx);
    const { token } = await api.register();
    await api.start(token);
    const floor = getCurrentFloor(createRunWithConfig(runSeedOf(WEEK), config));
    const blocked = floor.findIndex((_, i) => isBlockedCell(floor, i));
    // 週替わりの帯（2日目相当）のテンプレートには、どれも使用不可がある
    expect(blocked).toBeGreaterThanOrEqual(0);
    const ops: RunOp[] = [
      { op: 'place', partId: 'dock', x: blocked % 7, y: Math.floor(blocked / 7), dir: 0 },
    ];
    expect((await api.commit(token, 0, ops)).status).toBe(400);
  });

  it('古い SIM_VERSION で生成された週への提出は拒否される', async () => {
    const { ctx } = testContext();
    await seedEasyWeek(ctx);
    const api = testApi(ctx);
    // 古い sim のうちに誰かが本番を確定した週（作り直されずに残る）
    const other = await api.register();
    await api.start(other.token);
    expect((await api.commit(other.token, 0, SIMPLE_OPS)).status).toBe(200);
    const real = (await ctx.repos.weeks.find(WEEK))!;
    await ctx.repos.weeks.save({ ...real, simVersion: '4' });
    const { token } = await api.register();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await api.start(token);
    error.mockRestore();
    expect(await api.commit(token, 0, SIMPLE_OPS)).toEqual({
      status: 409,
      json: { error: 'simVersionMismatch' },
    });
  });
});

describe('ランダム配置権（SIM_VERSION 6）', () => {
  it('ショップで買って使う操作ログがサーバーで検証され、湧いた床の結果がクライアントと一致する。相場の集計に入らない', async () => {
    const { ctx } = testContext();
    // 配置権が必ず並ぶようにした週
    const config = await seedEasyWeek(ctx, (c) => ({
      ...c,
      floorPermit: { ...c.floorPermit!, offerChancePercent: 100 },
    }));
    const api = testApi(ctx);
    const { token } = await api.register();
    expect((await api.start(token)).status).toBe(200);

    const state = createRunWithConfig(runSeedOf(WEEK), config);
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
    const stats = await ctx.repos.shopStats.get(WEEK);
    expect(stats.length).toBeGreaterThan(0);
    expect(stats.every((row) => PART_IDS.includes(row.partId))).toBe(true);
  });

  it('知らない消耗品を使う操作は拒否される', async () => {
    const { ctx } = testContext();
    await seedEasyWeek(ctx);
    const api = testApi(ctx);
    const { token } = await api.register();
    await api.start(token);
    const ops = [{ op: 'useItem', itemId: 'lava' } as never];
    expect((await api.commit(token, 0, ops)).status).toBe(400);
    // 持っていない配置権を使う操作も拒否される
    expect((await api.commit(token, 0, [{ op: 'useItem', itemId: 'floorPermit' }])).status).toBe(
      400,
    );
  });
});

describe('ゴールデンデータ（秘密値・本番シード・出荷量の導出が変わっていないこと）', () => {
  it('固定のマスター鍵・週・盤面から常に同じ値になる', async () => {
    const { ctx } = testContext();
    const api = testApi(ctx);
    const today = await api.call('GET', '/weekly/current');
    const { token } = await api.register();
    await api.start(token);
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
        "seed": 1973029535,
        "seedCommitment": "7df3221189553ccaead411b702a5160ed90794e8031ae45e6cd28dcc72885897",
      }
    `);
    // クライアントの simulate 単体でも同じ出荷量
    const replayed = replayOps(createRunWithConfig(runSeedOf(WEEK), config), ops);
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
