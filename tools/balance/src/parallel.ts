/**
 * シードをワーカーに分けて並列にランを実行する
 */
import { Worker } from 'node:worker_threads';
import type { BotName } from './bots';
import type { RunLog, RunnerOptions } from './runner';

export async function runParallel(
  seeds: number[],
  bot: BotName,
  options: RunnerOptions,
  workers: number,
  onProgress: (done: number) => void,
): Promise<RunLog[]> {
  const count = Math.max(1, Math.min(workers, seeds.length));
  // シードを順番に振り分ける（重いシードが1つのワーカーに偏りにくいように交互に割り当てる）
  const chunks: number[][] = Array.from({ length: count }, () => []);
  seeds.forEach((seed, i) => chunks[i % count]!.push(seed));

  const logs: RunLog[] = [];
  await Promise.all(
    chunks.map(
      (chunk) =>
        new Promise<void>((resolve, reject) => {
          // TypeScript のまま動かすため、ワーカーの中で tsx を登録してから worker.ts を読み込む
          const workerUrl = new URL('./worker.ts', import.meta.url).href;
          const bootstrap = `
            import('tsx/esm/api').then(({ register }) => {
              register();
              return import(${JSON.stringify(workerUrl)});
            });
          `;
          const worker = new Worker(bootstrap, {
            eval: true,
            workerData: { seeds: chunk, bot, options },
          });
          worker.on('message', (log: RunLog) => {
            logs.push(log);
            onProgress(logs.length);
          });
          worker.on('error', reject);
          worker.on('exit', (code) =>
            code === 0 ? resolve() : reject(new Error(`worker exit ${code}`)),
          );
        }),
    ),
  );
  return logs.sort((a, b) => a.seed - b.seed);
}
