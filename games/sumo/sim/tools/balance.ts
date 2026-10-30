/**
 * バランス計測: ボットで何代も遊び、結果をまとめる
 *
 *   pnpm --filter @ichimon/sim balance -- --seeds 20 --basho 300
 *
 * 結果は標準出力に Markdown で出す（docs/balance-log.md に貼って記録する）
 */
import { advanceBasho, createGame, type GameState } from '../src';
import { decide, type BotKind } from './bots';

const arg = (name: string, fallback: number) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
};
const SEEDS = arg('seeds', 12);
const BASHO = arg('basho', 300);

interface RunResult {
  bot: BotKind;
  basho: number;
  gameOver: GameState['gameOver'];
  generations: number;
  sekitori: number;
  sanyaku: number;
  yokozuna: number;
  yusho: number;
  peakMine: number;
  minMoney: number;
  endMoney: number;
  branches: number;
  /** 番付全体の様子（場所ごとの平均） */
  yokozunaCount: number;
  ozekiCount: number;
  makuuchiAge: number;
  newSekitoriAge: number[];
  retireAge: number[];
}

function run(seed: number, bot: BotKind): RunResult {
  let s = createGame({ seed });
  let peakMine = 0;
  let minMoney = Infinity;
  let y = 0;
  let o = 0;
  let age = 0;
  let samples = 0;
  const newSekitoriAge: number[] = [];
  const retireAge: number[] = [];
  for (let i = 0; i < BASHO && !s.gameOver; i++) {
    s = advanceBasho(decide(s, bot));
    const mine = s.rikishi.filter((r) => r.stableId === s.player.stableId).length;
    peakMine = Math.max(peakMine, mine);
    minMoney = Math.min(minMoney, s.player.stableMoney + s.player.personalMoney);
    const titles = Object.values(s.titles);
    y += titles.filter((t) => t === 'Y').length;
    o += titles.filter((t) => t === 'O').length;
    const byId = new Map(s.rikishi.map((r) => [r.id, r]));
    const makuuchi = s.banzuke.slice(0, 42).map((id) => byId.get(id)!.age);
    age += makuuchi.reduce((a, b) => a + b, 0) / makuuchi.length;
    samples++;
    for (const p of s.lastReport!.promotions) {
      if (p.to === 'sekitori') newSekitoriAge.push(byId.get(p.id)?.age ?? 0);
    }
  }
  const lineage = s.player.lineage;
  for (const a of s.player.alumni) retireAge.push(a.retiredAge);
  return {
    bot,
    basho: s.bashoIndex,
    gameOver: s.gameOver,
    generations: s.player.generation,
    sekitori: lineage.reduce((n, l) => n + l.sekitori, 0),
    sanyaku: lineage.reduce((n, l) => n + l.sanyaku, 0),
    yokozuna: lineage.reduce((n, l) => n + l.yokozuna, 0),
    yusho: lineage.reduce((n, l) => n + l.makuuchiYusho, 0),
    peakMine,
    minMoney,
    endMoney: s.player.stableMoney + s.player.personalMoney,
    branches: s.stables.filter((x) => x.branch).length,
    yokozunaCount: y / Math.max(1, samples),
    ozekiCount: o / Math.max(1, samples),
    makuuchiAge: age / Math.max(1, samples),
    newSekitoriAge,
    retireAge,
  };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const f1 = (x: number) => x.toFixed(1);
const man = (yen: number) => `${Math.round(yen / 10_000).toLocaleString('ja-JP')}万円`;

const started = performance.now();
const lines: string[] = [];
lines.push(`# 一門 バランス計測（seeds 1〜${SEEDS}・最大 ${BASHO} 場所）`, '');
lines.push(
  '| ボット | 続いた場所 | 途絶え（跡継ぎなし / 破産） | 代 | 関取 | 三役 | 横綱 | 幕内優勝 | 弟子の最大 | お金の最小 | 最後のお金 | 分家 |',
);
lines.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
const all: RunResult[] = [];
for (const bot of ['careful', 'passive'] as const) {
  const rs = Array.from({ length: SEEDS }, (_, i) => run(i + 1, bot));
  all.push(...rs);
  const ended = rs.filter((r) => r.gameOver);
  lines.push(
    `| ${bot} | ${f1(avg(rs.map((r) => r.basho)))} | ${ended.filter((r) => r.gameOver === 'noSuccessor').length} / ${ended.filter((r) => r.gameOver === 'bankrupt').length} | ${f1(avg(rs.map((r) => r.generations)))} | ${f1(avg(rs.map((r) => r.sekitori)))} | ${f1(avg(rs.map((r) => r.sanyaku)))} | ${f1(avg(rs.map((r) => r.yokozuna)))} | ${f1(avg(rs.map((r) => r.yusho)))} | ${f1(avg(rs.map((r) => r.peakMine)))} | ${man(avg(rs.map((r) => r.minMoney)))} | ${man(avg(rs.map((r) => r.endMoney)))} | ${f1(avg(rs.map((r) => r.branches)))} |`,
  );
}
lines.push('', '## 番付全体の様子（実際の目安と比べる）', '');
lines.push('| 項目 | 計測 |', '|---|---|');
lines.push(`| 横綱の人数（場所ごとの平均） | ${f1(avg(all.map((r) => r.yokozunaCount)))} |`);
lines.push(`| 大関の人数（場所ごとの平均） | ${f1(avg(all.map((r) => r.ozekiCount)))} |`);
lines.push(`| 幕内の平均年齢 | ${f1(avg(all.map((r) => r.makuuchiAge)))} 歳 |`);
lines.push(`| 新十両の年齢（平均） | ${f1(avg(all.flatMap((r) => r.newSekitoriAge)))} 歳 |`);
lines.push(`| 自分の弟子の引退年齢（平均） | ${f1(avg(all.flatMap((r) => r.retireAge)))} 歳 |`);
lines.push('', `計測時間: ${((performance.now() - started) / 1000).toFixed(0)} 秒`);
console.log(lines.join('\n'));
