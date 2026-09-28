/**
 * 定期実行するジョブの一覧（トリガーから呼ばれる）
 *
 * 順番に意味がある: 相場（前日の購入率から今日の価格）→ デイリー生成（今日の価格で RunConfig を作る）。
 * どれも冪等なので、毎時実行しても結果は変わらない（失敗しても次の回で再試行される）。
 */
import type { DomainContext } from '../domain/context';
import { runDailyJob } from '../domain/daily/dailyJob';
import { runMarketJob } from '../domain/market/market';
import { runIpPurgeJob } from '../domain/players/privacy';

export async function runScheduledJobs(ctx: DomainContext) {
  const market = await runMarketJob(ctx);
  const daily = await runDailyJob(ctx);
  const ipPurge = await runIpPurgeJob(ctx);
  const summary = { market: market.date, daily: daily.dailyId, ipHashesPurged: ipPurge.purged };
  console.log('scheduled jobs', summary);
  return summary;
}
