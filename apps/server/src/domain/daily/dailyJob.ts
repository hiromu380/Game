/**
 * デイリー生成（ジョブ関数。トリガー＝Cron とは分離し、単体でも実行できる）
 *
 * その日のデイリーがなければ作る。何度実行しても結果は同じ（冪等）:
 * - 設定はデイリーの ID と相場から決定論的に作られる
 * - 秘密値はマスター秘密鍵から導き出すので DB には保存しない
 * - DB への書き込みは「なければ作る」
 *
 * 相場は「前日の購入率」から決まるため、前日が締め切られてからでないと当日分を作れない。
 * そのため翌日分を前もって作ることはせず、切り替え時刻の Cron と、API の初回アクセスの両方で呼ぶ。
 */
import { buildWeeklyConfig, type PartId, SIM_VERSION } from '@chain-factory/sim';
import type { DomainContext } from '../context';
import { ensureMarket } from '../market/market';
import type { DailyRecord } from '../../repositories/types';
import { dailyIdAt, dailyNumber, dailyWindow } from './calendar';
import { commitmentOf, deriveDailySecret } from './dailySecret';

/** 指定日のデイリーを作る（すでにあれば何もしない）。作った・既存のレコードを返す */
export async function ensureDaily(ctx: DomainContext, dailyId: string): Promise<DailyRecord> {
  const existing = await ctx.repos.dailies.find(dailyId);
  if (existing) return existing;

  // その日の相場（なければ前日の集計から計算する）を価格として埋め込む
  const prices: Partial<Record<PartId, number>> = {};
  for (const row of await ensureMarket(ctx, dailyId)) prices[row.partId] = row.price;

  const secret = await deriveDailySecret(ctx.config.masterSecret, dailyId);
  const record: DailyRecord = {
    id: dailyId,
    number: dailyNumber(dailyId, ctx.config.dailyEpoch),
    config: buildWeeklyConfig({ weekId: dailyId, prices }),
    seedCommitment: await commitmentOf(secret),
    simVersion: SIM_VERSION,
    ...dailyWindow(dailyId, ctx.config.dailyOffsetMinutes),
  };
  await ctx.repos.dailies.createIfAbsent(record);
  // 同時に作られた場合に備え、DB に入っている方を正とする
  return (await ctx.repos.dailies.find(dailyId)) ?? record;
}

/** ジョブ本体: 現在時刻の日のデイリーを用意する */
export async function runDailyJob(ctx: DomainContext): Promise<{ dailyId: string }> {
  const dailyId = dailyIdAt(ctx.now(), ctx.config.dailyOffsetMinutes);
  await ensureDaily(ctx, dailyId);
  return { dailyId };
}
