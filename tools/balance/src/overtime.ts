/**
 * 延長戦の到達点の計測（「計測不能」の閾値を決める根拠: docs/balance-log.md）
 *
 *   pnpm --filter @chain-factory/balance overtime --seeds 40 --bots greedy,mid
 *
 * ボットに通常ランを通しで遊ばせ、全シフトをクリアしたら延長戦に入って脱落まで続ける（上限 --max-days 日）。
 * 1シフトの出荷量の桁数の分布と最大値を出す。全パーツ解放・工場拡張も最大（やり込んだ状態）
 */
import { playRun, type BotName, type RunnerOptions } from '@chain-factory/bots';

const args = new Map<string, string>();
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  if (argv[i]!.startsWith('--')) args.set(argv[i]!.slice(2), argv[i + 1] ?? '');
}
const seeds = Number(args.get('seeds') ?? 20);
const start = Number(args.get('start') ?? 1);
const bots = (args.get('bots') ?? 'greedy,mid').split(',') as BotName[];
const maxDays = Number(args.get('max-days') ?? 10);

const options: RunnerOptions = {
  unlock: 'all',
  samples: 3,
  evalMode: 'mean',
  timeLimitMs: Number(args.get('time-limit') ?? 1500),
  maxRerolls: 3,
};

for (const bot of bots) {
  const digits = new Map<number, number>();
  let best = 0n;
  let bestAt = '';
  const reached: number[] = [];
  for (let seed = start; seed < start + seeds; seed++) {
    const log = playRun(seed, bot, { ...options, overtimeDays: maxDays });
    reached.push(log.shiftsCleared);
    for (const s of log.shifts) {
      const d = s.score.length;
      digits.set(d, (digits.get(d) ?? 0) + 1);
      if (BigInt(s.score) > best) {
        best = BigInt(s.score);
        bestAt = `seed=${seed} shift=${s.shiftIndex}`;
      }
    }
  }
  console.log(`## ${bot}（${seeds} シード・延長戦は最大 ${maxDays} 日）`);
  console.log(`- 最大: ${best}（${best.toString().length} 桁, ${bestAt}）`);
  console.log(
    `- クリアしたシフト数: 平均 ${(reached.reduce((a, b) => a + b, 0) / reached.length).toFixed(1)}・最大 ${Math.max(...reached)}`,
  );
  console.log('- 1シフトの出荷量の桁数（シフト数）:');
  for (const [d, n] of [...digits.entries()].sort((a, b) => a[0] - b[0]))
    console.log(`  - ${d} 桁: ${n}`);
}
