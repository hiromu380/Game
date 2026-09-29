/**
 * バランス検証 CLI
 *
 * 使い方:
 *   pnpm balance --seeds 1000                  # 全ボットで 1000 シード（探索ボットは --search-seeds まで）
 *   pnpm balance --seeds 200 --bots greedy,mid # ボットを指定（random / greedy / mid / search）
 *   pnpm balance --seeds 100 --start 5000      # シード 5000〜5099
 *   pnpm balance --unlock all                  # 全パーツ解放済みの状態で検証（既定は初期解放のみ）
 *   pnpm balance --eval worst --samples 5      # ランダムな盤面を「5回試して最悪の回」で評価する（慎重なプレイヤー）
 *   pnpm balance --mode daily                  # デイリーと同じ条件（3シフト・全パーツ・特殊ルール）で検証
 *   pnpm balance --floor-aware off             # 床を見ないボット（床を使うボットとの比較用）
 *
 * 出力: tools/balance/reports/latest.md と、日時つきの .md / .json
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BALANCE } from '@chain-factory/sim';
import type { BotName } from './bots';
import { runParallel } from './parallel';
import { summarize, toMarkdown, type BotSummary } from './report';
import type { RunnerOptions } from './runner';

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]!;
    if (key.startsWith('--')) args.set(key.slice(2), argv[i + 1] ?? '');
  }
  const seeds = Number(args.get('seeds') ?? 200);
  return {
    seeds,
    start: Number(args.get('start') ?? 1),
    bots: (args.get('bots') ?? 'random,greedy,mid,search').split(',') as BotName[],
    // 探索ボットは重いので、既定では最大 100 シードに絞る
    searchSeeds: Number(args.get('search-seeds') ?? Math.min(seeds, 100)),
    workers: Number(args.get('workers') ?? cpus().length),
    samples: Number(args.get('samples') ?? 3),
    evalMode: (args.get('eval') === 'worst' ? 'worst' : 'mean') as 'mean' | 'worst',
    timeLimitMs: Number(args.get('time-limit') ?? 3000),
    maxRerolls: Number(args.get('max-rerolls') ?? 3),
    unlock: (args.get('unlock') === 'all' ? 'all' : 'initial') as 'initial' | 'all',
    mode: (args.get('mode') === 'daily' ? 'daily' : 'normal') as 'normal' | 'daily',
    floorAware: args.get('floor-aware') !== 'off',
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const runnerOptions: RunnerOptions = {
    unlock: opts.unlock,
    samples: opts.samples,
    evalMode: opts.evalMode,
    timeLimitMs: opts.timeLimitMs,
    maxRerolls: opts.maxRerolls,
    mode: opts.mode,
    floorAware: opts.floorAware,
  };
  const summaries: BotSummary[] = [];
  const shiftSpecs = opts.mode === 'daily' ? BALANCE.daily.shifts : BALANCE.shifts;
  const allLogs: Record<string, unknown> = {};

  for (const bot of opts.bots) {
    const n = bot === 'search' ? opts.searchSeeds : opts.seeds;
    const seeds = Array.from({ length: n }, (_, i) => opts.start + i);
    const started = Date.now();
    const logs = await runParallel(seeds, bot, runnerOptions, opts.workers, (done) => {
      process.stdout.write(`\r${bot}: ${done}/${n}`);
    });
    process.stdout.write(`\r${bot}: ${n}/${n} (${((Date.now() - started) / 1000).toFixed(1)}s)\n`);
    summaries.push(summarize(bot, logs, shiftSpecs));
    allLogs[bot] = logs;
  }

  const meta = {
    日時: new Date().toISOString(),
    シード: `${opts.start}〜（${opts.seeds} 個。search は ${opts.searchSeeds} 個）`,
    モード:
      opts.mode === 'daily' ? 'デイリー（3シフト・全パーツ・特殊ルール）' : '通常ラン（9シフト）',
    評価の試行回数: opts.samples,
    ランダムな盤面の評価: opts.evalMode === 'worst' ? '最悪の回（慎重）' : '平均（期待値）',
    探索の思考時間上限: `${opts.timeLimitMs}ms/シフト`,
    リロール上限: `${opts.maxRerolls}回/シフト`,
    床: opts.floorAware ? '床を見て置く' : '床を見ない（比較用）',
    パーツの解放:
      opts.unlock === 'all'
        ? '全解放・工場拡張最大（やり込み相当）'
        : '初期解放のみ・7×7（初プレイ相当）',
  };
  const markdown = toMarkdown(summaries, meta, shiftSpecs);

  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'reports');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  writeFileSync(join(dir, 'latest.md'), markdown);
  writeFileSync(join(dir, `${stamp}.md`), markdown);
  writeFileSync(
    join(dir, `${stamp}.json`),
    JSON.stringify({ meta, summaries, logs: allLogs }, null, 2),
  );
  console.log('\n' + markdown);
}

void main();
