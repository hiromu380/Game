/**
 * 定期実行するジョブの一覧（トリガーから呼ばれる。毎時）
 *
 * 順番に意味がある:
 *   1. 先行生成（数週先までの盤面）→ 2. 公開前の自動検証（予算の範囲で少しずつ）
 *   → 3. 今週を開く（週の切り替えの直後に前週の購入率から相場を確定）→ 4. 前週の結果を確定
 *   → 5. 保存期間を過ぎたデータを消す
 * どれも冪等なので、毎時実行しても結果は変わらない（失敗しても次の回で続きから再試行される）。
 */
import type { DomainContext } from '../domain/context';
import { runIpPurgeJob } from '../domain/players/privacy';
import { runFinalizeJob, runWeeklyPurgeJob } from '../domain/weekly/results';
import { prepareWeeks, runOpenWeekJob, verifyWeeks } from '../domain/weekly/weeks';

export async function runScheduledJobs(ctx: DomainContext) {
  const prepared = await prepareWeeks(ctx);
  const verify = await verifyWeeks(ctx);
  const open = await runOpenWeekJob(ctx);
  const finalize = await runFinalizeJob(ctx);
  const purge = await runWeeklyPurgeJob(ctx);
  const ipPurge = await runIpPurgeJob(ctx);
  const summary = {
    prepared,
    verified: verify.verified,
    verifySteps: verify.steps,
    opened: open.weekId,
    finalized: finalize.finalized,
    purgedAttempts: purge.attempts,
    ipHashesPurged: ipPurge.purged,
  };
  console.log('scheduled jobs', summary);
  return summary;
}
