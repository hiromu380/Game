/**
 * 定期ジョブの統合テスト: 先行生成・公開前の自動検証（代替設定への切り替え）・週の切り替え（相場の確定）・
 * 実行順・冪等性・IP ハッシュの削除
 */
import { buildWeeklyConfig } from '@chain-factory/sim';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WEEKLY_CONFIG } from '../src/config/weekly';
import type * as BoardCheck from '../src/domain/weekly/boardCheck';
import { runScheduledJobs } from '../src/jobs/scheduled';
import { MARKET_PARTS, priceFor } from '../src/domain/market/market';
import { openWeek, prepareWeeks, verifyWeeks } from '../src/domain/weekly/weeks';
import { DAY_MS, NOON, testContext, WEEK } from './helpers';

/** 盤面の検証（ボットのプレイ）を差し替える。'real' のときは本物のボットで試す */
const board = vi.hoisted(() => ({ mode: 'real' as 'real' | 'pass' | 'fail' | 'throw', calls: 0 }));
vi.mock('../src/domain/weekly/boardCheck', async (importOriginal) => {
  const original = await importOriginal<typeof BoardCheck>();
  return {
    ...original,
    checkSample: (...args: Parameters<typeof original.checkSample>) => {
      board.calls++;
      if (board.mode === 'pass') return true;
      if (board.mode === 'fail') return false;
      if (board.mode === 'throw') throw new Error('crash');
      return original.checkSample(...args);
    },
  };
});

const NEXT_WEEK = '2026-10-05';
const PREVIOUS_WEEK = '2026-09-21';
/** 時間の予算を気にせず最後まで進める時計 */
const frozen = () => 0;

beforeEach(() => {
  board.mode = 'pass';
  board.calls = 0;
});

describe('先行生成', () => {
  it('今週から数週先までを作り、公開前は config が空。何度実行しても同じ', async () => {
    const { ctx } = testContext();
    const ids = await prepareWeeks(ctx);
    expect(ids).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
    expect(ids).toHaveLength(WEEKLY_CONFIG.prepareAheadWeeks + 1);
    const week = await ctx.repos.weeks.find(NEXT_WEEK);
    expect(week).toMatchObject({ number: 2, candidate: 0, verifyState: 'pending', config: null });
    await prepareWeeks(ctx);
    expect(await ctx.repos.weeks.find(NEXT_WEEK)).toEqual(week);
  });
});

describe('公開前の自動検証', () => {
  it('本物のボットで今週の盤面を検証できる', async () => {
    board.mode = 'real';
    const { ctx } = testContext();
    await prepareWeeks(ctx);
    await verifyWeeks(ctx, frozen);
    const week = await ctx.repos.weeks.find(WEEK);
    expect(week?.verifyState).not.toBe('pending');
  });

  it('合格した候補で止まる', async () => {
    const { ctx } = testContext();
    const { verified } = await verifyWeeks(ctx, frozen);
    expect(verified).toEqual([WEEK, NEXT_WEEK, '2026-10-12']);
    const week = await ctx.repos.weeks.find(NEXT_WEEK);
    expect(week).toMatchObject({ candidate: 0, verifyState: 'verified', fallback: false });
    expect(week?.verifySamples).toHaveLength(WEEKLY_CONFIG.verify.minClears);
  });

  it('不合格なら候補を引き直し、上限に達したら代替設定にする', async () => {
    board.mode = 'fail';
    const { ctx } = testContext();
    await verifyWeeks(ctx, frozen);
    const { maxCandidates, samples } = WEEKLY_CONFIG.verify;
    const week = (await ctx.repos.weeks.find(NEXT_WEEK))!;
    expect(week).toMatchObject({ verifyState: 'fallback', fallback: true });
    expect(week.verifySamples).toHaveLength(maxCandidates * samples);
    expect(week.baseConfig).toEqual(
      buildWeeklyConfig({ weekId: NEXT_WEEK, candidate: week.candidate, fallback: true }),
    );
  });

  it('時間の予算を超えたら途中でやめ、次の回に続きから進める（最低1試行は進める）', async () => {
    board.mode = 'fail';
    const { ctx } = testContext();
    let t = 0;
    const clock = () => (t += WEEKLY_CONFIG.verify.budgetMs);
    expect(await verifyWeeks(ctx, clock)).toEqual({ verified: [], steps: 1 });
    expect(await verifyWeeks(ctx, clock)).toEqual({ verified: [], steps: 1 });
    expect((await ctx.repos.weeks.find(WEEK))!.verifySamples).toHaveLength(2);
  });

  it('試行の途中でジョブが止まっても、次の回はその試行を不合格にして先へ進む（無限に繰り返さない）', async () => {
    board.mode = 'throw';
    const { ctx } = testContext();
    await expect(verifyWeeks(ctx, frozen)).rejects.toThrow('crash');
    expect((await ctx.repos.weeks.find(WEEK))!.verifySamples).toEqual([
      { candidate: 0, sample: 0, started: true, cleared: null },
    ]);
    board.mode = 'pass';
    await verifyWeeks(ctx, frozen);
    const week = (await ctx.repos.weeks.find(WEEK))!;
    expect(week.verifySamples[0]).toMatchObject({ sample: 0, cleared: false });
    expect(week.verifyState).toBe('verified');
  });
});

describe('週の切り替え', () => {
  it('前週の相場を引き継いで config を確定し、あとから変わらない', async () => {
    const { ctx } = testContext();
    const previous = MARKET_PARTS.map((partId) => {
      const multiplierMilli = partId === 'gear' ? 1500 : 1000;
      return { partId, multiplierMilli, price: priceFor(partId, multiplierMilli) };
    });
    await ctx.repos.market.put(PREVIOUS_WEEK, previous);
    await verifyWeeks(ctx, frozen);
    const opened = await openWeek(ctx, WEEK);
    expect(opened.marketState).toBe('market');
    // 前週の参加者がいない → 据え置き（前週の倍率のまま）
    expect(opened.config?.economy.prices.gear).toBe(priceFor('gear', 1500));
    await ctx.repos.market.put(WEEK, []);
    expect(await openWeek(ctx, WEEK)).toEqual(opened);
  });

  it('検証が終わっていなければ代替設定で始める', async () => {
    const { ctx } = testContext();
    const opened = await openWeek(ctx, WEEK);
    expect(board.calls).toBe(0);
    expect(opened).toMatchObject({ fallback: true, verifyState: 'fallback' });
    expect(opened.config?.globalModifier).toBeNull();
  });

  it('相場の計算に失敗したら基準価格で始める', async () => {
    const { ctx } = testContext();
    const repos = {
      ...ctx.repos,
      shopStats: {
        ...ctx.repos.shopStats,
        get: () => Promise.reject(new Error('db down')),
      },
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const opened = await openWeek({ ...ctx, repos }, WEEK);
    spy.mockRestore();
    expect(opened.marketState).toBe('base');
    expect(opened.config).toEqual(
      buildWeeklyConfig({ weekId: WEEK, candidate: 0, fallback: true, prices: {} }),
    );
  });
});

describe('定期ジョブ', () => {
  it('用意 → 検証 → 今週を開く → 結果の確定 → 削除 の順に進み、再実行しても変わらない', async () => {
    const { ctx } = testContext();
    await ctx.repos.players.create({
      id: 'expired-ip',
      tokenHash: 'token-hash',
      displayName: 'Expired',
      hidden: false,
      createdAt: NOON - (ctx.config.ipHashRetentionDays + 1) * DAY_MS,
      registeredIpHash: 'hashed-ip',
    });

    const first = await runScheduledJobs(ctx);
    expect(first).toMatchObject({
      prepared: [WEEK, NEXT_WEEK, '2026-10-12'],
      opened: WEEK,
      finalized: [],
      ipHashesPurged: 1,
    });
    const week = await ctx.repos.weeks.find(WEEK);
    expect(week?.config).not.toBeNull();
    expect(await ctx.repos.market.get(WEEK)).toHaveLength(MARKET_PARTS.length);
    expect((await ctx.repos.players.findById('expired-ip'))?.registeredIpHash).toBeNull();

    const second = await runScheduledJobs(ctx);
    expect(second).toMatchObject({ opened: WEEK, verifySteps: 0, ipHashesPurged: 0 });
    expect(await ctx.repos.weeks.find(WEEK)).toEqual(week);
  });
});
