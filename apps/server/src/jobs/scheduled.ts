/**
 * 定期実行するジョブの一覧（トリガーから呼ばれる）
 *
 * 順番に意味がある: 相場（前日の購入数から今日の価格）→ デイリー生成（今日の価格で RunConfig を作る）。
 * 相場ジョブはフェーズ3b で追加する。
 */
import type { DomainContext } from '../domain/context';
import { runDailyJob } from '../domain/daily/dailyJob';

export async function runScheduledJobs(ctx: DomainContext): Promise<void> {
  const daily = await runDailyJob(ctx);
  console.log(`daily job: ${daily.dailyId}`);
}
