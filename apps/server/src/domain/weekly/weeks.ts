/**
 * 週の用意（ジョブ関数。トリガー＝Cron とは分離し、単体でも実行できる）
 *
 * 1. 先行生成（prepareWeeks）: 相場に依存しない部分（床・ボス・特殊ルール・ショップのシード）を数週先まで作る
 * 2. 公開前の自動検証（verifyWeeks）: 貪欲ボットで「クリアできるか」を少しずつ試す（domain/weekly/boardCheck.ts）。
 *    不合格なら候補番号を進めて引き直し、上限に達したら固定の代替設定（buildWeeklyConfig の fallback）にする
 * 3. 週の切り替え（openWeek）: 前週の購入率から相場を確定して埋め込む。相場の計算に失敗したら基準価格で始め、
 *    その週のうちは変えない（公平性のため）。検証が終わっていなければ代替設定で始める
 *
 * どれも何度実行しても結果は同じ（冪等）。DB への書き込みは「なければ作る」か、決定論的な値での上書き。
 */
import { buildWeeklyConfig, SIM_VERSION, type PartId, type RunConfig } from '@chain-factory/sim';
import { WEEKLY_CONFIG } from '../../config/weekly';
import type { WeekRecord } from '../../repositories/types';
import type { DomainContext } from '../context';
import { ensureMarket } from '../market/market';
import { checkSample } from './boardCheck';
import { addWeeks, weekIdAt, weekNumber, weekWindow, type CalendarConfig } from './calendar';
import { commitmentOf, deriveWeekSecret } from './secret';

export function calendarOf(ctx: DomainContext): CalendarConfig {
  return { offsetMinutes: ctx.config.offsetMinutes, weekStartDay: ctx.config.weekStartDay };
}

/** now の時点の週の ID */
export function currentWeekId(ctx: DomainContext): string {
  return weekIdAt(ctx.now(), calendarOf(ctx));
}

/** 候補番号・代替設定から、相場を入れる前の RunConfig を作る */
function baseConfigOf(weekId: string, candidate: number, fallback: boolean): RunConfig {
  return buildWeeklyConfig({ weekId, candidate, fallback });
}

/** 指定した週を用意する（すでにあれば何もしない）。作った・既存のレコードを返す */
export async function ensureWeek(ctx: DomainContext, weekId: string): Promise<WeekRecord> {
  const existing = await ctx.repos.weeks.find(weekId);
  if (existing) return existing;
  const secret = await deriveWeekSecret(ctx.config.masterSecret, weekId);
  const record: WeekRecord = {
    id: weekId,
    number: weekNumber(weekId, ctx.config.weeklyEpoch),
    candidate: 0,
    fallback: false,
    verifyState: 'pending',
    verifySamples: [],
    baseConfig: baseConfigOf(weekId, 0, false),
    config: null,
    marketState: 'pending',
    seedCommitment: await commitmentOf(secret),
    simVersion: SIM_VERSION,
    ...weekWindow(weekId, ctx.config.offsetMinutes),
  };
  await ctx.repos.weeks.createIfAbsent(record);
  // 同時に作られた場合に備え、DB に入っている方を正とする
  return (await ctx.repos.weeks.find(weekId)) ?? record;
}

/** 候補を引き直す（上限に達したら代替設定にする） */
function nextCandidate(week: WeekRecord): WeekRecord {
  const candidate = week.candidate + 1;
  if (candidate >= WEEKLY_CONFIG.verify.maxCandidates) {
    console.warn(`weekly board fallback week=${week.id} candidates=${candidate}`);
    return {
      ...week,
      fallback: true,
      verifyState: 'fallback',
      baseConfig: baseConfigOf(week.id, week.candidate, true),
    };
  }
  return { ...week, candidate, baseConfig: baseConfigOf(week.id, candidate, false) };
}

/**
 * 公開前の自動検証を1試行だけ進める（試し始めたことを先に保存してから試す。
 * 途中でジョブが止まっても、次の回はその試行を不合格として先へ進むので、同じ試行を無限に繰り返さない）
 */
async function verifyOneSample(ctx: DomainContext, week: WeekRecord): Promise<WeekRecord> {
  const { samples, minClears } = WEEKLY_CONFIG.verify;
  const mine = week.verifySamples.filter((s) => s.candidate === week.candidate);
  let next: WeekRecord;
  const stalled = mine.find((s) => s.started && s.cleared === null);
  if (stalled) {
    // 前回のジョブが試行の途中で止まった → 不合格として記録する
    next = {
      ...week,
      verifySamples: week.verifySamples.map((s) => (s === stalled ? { ...s, cleared: false } : s)),
    };
  } else {
    const sample = mine.length;
    const started = {
      ...week,
      verifySamples: [
        ...week.verifySamples,
        { candidate: week.candidate, sample, started: true, cleared: null },
      ],
    };
    await ctx.repos.weeks.save(started);
    const cleared = checkSample(week.id, week.candidate, week.baseConfig, sample);
    next = {
      ...started,
      verifySamples: started.verifySamples.map((s) =>
        s.candidate === week.candidate && s.sample === sample ? { ...s, cleared } : s,
      ),
    };
  }
  const done = next.verifySamples.filter((s) => s.candidate === next.candidate);
  if (done.filter((s) => s.cleared === true).length >= minClears) {
    next = { ...next, verifyState: 'verified' };
  } else if (done.length >= samples && done.every((s) => s.cleared !== null)) {
    next = nextCandidate(next);
  }
  await ctx.repos.weeks.save(next);
  return next;
}

/** ジョブ: 今週から prepareAheadWeeks 週先までを用意する */
export async function prepareWeeks(ctx: DomainContext): Promise<string[]> {
  const current = currentWeekId(ctx);
  const ids: string[] = [];
  for (let i = 0; i <= WEEKLY_CONFIG.prepareAheadWeeks; i++) {
    const week = await ensureWeek(ctx, addWeeks(current, i));
    ids.push(week.id);
  }
  return ids;
}

/**
 * ジョブ: 未検証の週を、時間の予算（budgetMs）の範囲で少しずつ検証する（近い週から）。
 * 最低1試行は必ず進める（予算が小さすぎても、いつかは終わるように）
 */
export async function verifyWeeks(
  ctx: DomainContext,
  clock: () => number = () => Date.now(),
): Promise<{ verified: string[]; steps: number }> {
  const deadline = clock() + WEEKLY_CONFIG.verify.budgetMs;
  const current = currentWeekId(ctx);
  const verified: string[] = [];
  let steps = 0;
  // 今週の検証が終わっていなくても、公開済みなら代替設定で始まっているので、来週から見る
  for (let i = 0; i <= WEEKLY_CONFIG.prepareAheadWeeks; i++) {
    let week = await ensureWeek(ctx, addWeeks(current, i));
    if (week.config) continue;
    // 1つの週の試行の上限: 候補数 × 試行数（途中で止まった試行を不合格にする分を含めても有限）
    const limit = WEEKLY_CONFIG.verify.maxCandidates * WEEKLY_CONFIG.verify.samples * 2;
    for (let n = 0; week.verifyState === 'pending' && n < limit; n++) {
      if (steps > 0 && clock() >= deadline) return { verified, steps };
      week = await verifyOneSample(ctx, week);
      steps++;
    }
    if (week.verifyState !== 'pending') verified.push(week.id);
  }
  return { verified, steps };
}

/**
 * 週の切り替え: 相場を確定して RunConfig に埋め込む（すでに確定していれば何もしない）。
 * 検証が終わっていなければ代替設定で始める。相場の計算に失敗したら基準価格で始める（あとから変えない）
 */
export async function openWeek(ctx: DomainContext, weekId: string): Promise<WeekRecord> {
  let week = await ensureWeek(ctx, weekId);
  if (week.config) return week;
  if (week.verifyState === 'pending') {
    console.warn(`weekly board not verified before opening, using fallback week=${weekId}`);
    week = {
      ...week,
      fallback: true,
      verifyState: 'fallback',
      baseConfig: baseConfigOf(weekId, week.candidate, true),
    };
  }
  let prices: Partial<Record<PartId, number>> = {};
  let marketState: WeekRecord['marketState'] = 'market';
  try {
    for (const row of await ensureMarket(ctx, weekId)) prices[row.partId] = row.price;
  } catch (err) {
    console.error(`market job failed, opening with base prices week=${weekId}`, err);
    prices = {};
    marketState = 'base';
  }
  const opened: WeekRecord = {
    ...week,
    marketState,
    config: buildWeeklyConfig({
      weekId,
      candidate: week.candidate,
      fallback: week.fallback,
      prices,
    }),
  };
  // 同時に開かれた場合に備え、先に確定した方を正とする
  const again = await ctx.repos.weeks.find(weekId);
  if (again?.config) return again;
  await ctx.repos.weeks.save(opened);
  return opened;
}

/** ジョブ: 今週を開く（週の切り替えの直後に相場を確定する） */
export async function runOpenWeekJob(ctx: DomainContext): Promise<{ weekId: string }> {
  const weekId = currentWeekId(ctx);
  await openWeek(ctx, weekId);
  return { weekId };
}
