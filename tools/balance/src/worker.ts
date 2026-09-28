/**
 * 並列実行用のワーカー: 担当するシードのランを実行して結果を返す
 */
import { parentPort, workerData } from 'node:worker_threads';
import type { BotName } from './bots';
import { playRun, type RunnerOptions } from './runner';

interface Job {
  seeds: number[];
  bot: BotName;
  options: RunnerOptions;
}

const job = workerData as Job;
for (const seed of job.seeds) {
  parentPort!.postMessage(playRun(seed, job.bot, job.options));
}
