/**
 * 計算量の計測（D13）: サーバーでの検証1回あたりにどれだけ CPU 時間を使うか
 *
 * 計測するもの:
 *   1. simulate 1回の最悪ケース
 *      - 分岐・再発動系のパーツを敷き詰めたランダムな盤面を大量に試し、最も遅かったもの
 *      - 信号が爆発して上限（maxLiveSignals / tickLimit）で止まる盤面
 *   2. デイリー本番の検証1回（最終シフト）
 *      = 確定済みシフトの再生（操作ログ + 本番）× 2 + 新しい操作ログの適用 + 本番
 *      操作ログはサーバーの上限（2000手）いっぱいにする
 *
 * Workers も Node も同じ V8 なので、Node での計測値に余裕を持たせて見積もる。
 * 実行: pnpm --filter @chain-factory/perf perf
 */
import {
  buildWeeklyConfig,
  commitShift,
  createPrng,
  createRunWithConfig,
  weeklyRunSeed,
  PART_IDS,
  replayOps,
  setPart,
  simulate,
  type Board,
  type Dir4,
  type PartId,
  type RuleSet,
  type RunOp,
  type RunState,
} from '@chain-factory/sim';

const DAILY_ID = '2026-10-01';
/** サーバーの操作ログの上限（apps/server/src/config/server.ts の maxOpsPerShift と同じ値） */
const MAX_OPS_PER_SHIFT = 2000;
const RANDOM_BOARDS = 3000;

/** 関数を何度か実行して、最も速かった回と平均（ミリ秒）を返す（初回は JIT の暖機で除外） */
function time(fn: () => void, repeat = 20): { best: number; mean: number } {
  fn();
  const samples: number[] = [];
  for (let i = 0; i < repeat; i++) {
    const start = performance.now();
    fn();
    samples.push(performance.now() - start);
  }
  return { best: Math.min(...samples), mean: samples.reduce((a, b) => a + b, 0) / samples.length };
}

/** 全マスにパーツを置いた盤面（スイッチは数個だけ） */
function randomDenseBoard(base: Board, seed: number, parts: readonly PartId[]): Board {
  const rng = createPrng(seed);
  let board = base;
  for (let y = 0; y < base.height; y++) {
    for (let x = 0; x < base.width; x++) {
      const id = rng.nextInt(100) < 6 ? 'switch' : parts[rng.nextInt(parts.length)]!;
      board = setPart(board, x, y, { id, dir: rng.nextInt(4) as Dir4 });
    }
  }
  return board;
}

/**
 * 最悪ケースの盤面を探す: ランダムな盤面から始め、1マスずつ書き換えて
 * 「イベント数（= 処理した信号の移動・発動の数）」が増えたら採用する山登り法
 */
function searchHeavyBoard(base: Board, rules: RuleSet, parts: PartId[]) {
  const rng = createPrng(12345);
  const cost = (board: Board) => simulate({ board, seed: 0, rules }).events.length;
  let best = { board: randomDenseBoard(base, 1, parts), events: 0 };
  best.events = cost(best.board);
  for (let i = 0; i < RANDOM_BOARDS; i++) {
    // 最初の半分はランダムな盤面から、後の半分は最良の盤面を少しずつ書き換える
    const candidate =
      i < RANDOM_BOARDS / 2
        ? randomDenseBoard(base, i + 2, parts)
        : setPart(best.board, rng.nextInt(base.width), rng.nextInt(base.height), {
            id: rng.nextInt(100) < 6 ? 'switch' : parts[rng.nextInt(parts.length)]!,
            dir: rng.nextInt(4) as Dir4,
          });
    const events = cost(candidate);
    if (events > best.events) best = { board: candidate, events };
  }
  return best;
}

function measureSimulate() {
  const run = createRunWithConfig(weeklyRunSeed(DAILY_ID), buildWeeklyConfig({ weekId: DAILY_ID }));
  // 特殊ルール（短縮営業など）は計算量を減らす方向なので、修正なしの基本ルールで測る
  const rules = run.config.rules;
  const allParts: PartId[] = PART_IDS.filter((id) => id !== 'switch');
  const branching: PartId[] = [
    'barrel',
    'spreader',
    'copier',
    'splitter',
    'rebooter',
    'oiler',
    'conveyor',
    'reflector',
  ];

  const candidates = [
    searchHeavyBoard(run.board, rules, allParts),
    searchHeavyBoard(run.board, rules, branching),
  ];
  const worst = candidates.reduce((a, b) => (b.events > a.events ? b : a));
  const result = simulate({ board: worst.board, seed: 0, rules });
  const timing = time(() => simulate({ board: worst.board, seed: 0, rules }));
  const halt = result.events.find((e) => e.type === 'halt');
  return {
    timing,
    events: worst.events,
    ticks: result.stats.ticks,
    halted: halt && 'reason' in halt ? String(halt.reason) : '-',
    /** 理論上の上限: 全 tick で信号数が上限に張り付いた場合のイベント数 */
    theoreticalEvents: rules.tickLimit * rules.maxLiveSignals,
  };
}

/** 盤面の端から端まで回転させ続ける、上限いっぱいの操作ログ（すべて有効な操作） */
function longOps(state: RunState): RunOp[] {
  const ops: RunOp[] = [
    { op: 'place', partId: 'switch', x: 0, y: 3, dir: 1 },
    { op: 'place', partId: 'gear', x: 1, y: 3, dir: 1 },
    { op: 'place', partId: 'dock', x: 2, y: 3, dir: 1 },
  ];
  while (ops.length < MAX_OPS_PER_SHIFT) ops.push({ op: 'rotate', x: 1, y: 3 });
  // 回転の回数を4の倍数にして元の向きに戻す
  while ((ops.length - 3) % 4 !== 0) ops.pop();
  void state;
  return ops;
}

function measureVerify() {
  const config = buildWeeklyConfig({ weekId: DAILY_ID });
  // ノルマは無視して最終シフトまで進めたいので、計測用にノルマを0にする（計算量は変わらない）
  const easy = {
    ...config,
    shifts: config.shifts.map((s) => ({ ...s, quota: 0 })),
    globalModifier: null,
    bossPlan: config.bossPlan.map(() => null),
  };
  const start = createRunWithConfig(weeklyRunSeed(DAILY_ID), easy);
  const shiftOps = [longOps(start), [] as RunOp[], [] as RunOp[]];

  const verifyLastShift = () => {
    let state = start;
    for (let i = 0; i < shiftOps.length; i++) {
      const replayed = replayOps(state, shiftOps[i]!);
      if (!replayed.ok) throw new Error(`replay failed: ${replayed.error}`);
      const committed = commitShift(replayed.state, { seed: 1000 + i });
      if ('error' in committed) throw new Error(committed.error);
      state = committed.state;
    }
  };
  return time(verifyLastShift, 10);
}

const sim = measureSimulate();
const verify = measureVerify();
const fmt = (n: number) => n.toFixed(2);
const perEvent = sim.timing.mean / sim.events;
const theoretical = perEvent * sim.theoreticalEvents;

console.log(`# 計算量の計測（Node ${process.version}）\n`);
console.log('| 項目 | 最速 (ms) | 平均 (ms) | 備考 |');
console.log('| --- | ---: | ---: | --- |');
console.log(
  `| simulate 最悪ケース（探索 ${RANDOM_BOARDS * 2} 盤面） | ${fmt(sim.timing.best)} | ${fmt(sim.timing.mean)} | events=${sim.events}, ticks=${sim.ticks}, halt=${sim.halted} |`,
);
console.log(
  `| simulate 理論上限（${sim.theoreticalEvents} イベント × 1イベントの時間） | — | ${fmt(theoretical)} | 実際の盤面では到達しない |`,
);
console.log(
  `| 検証1回（最終シフト・操作ログ ${MAX_OPS_PER_SHIFT} 手 + 本番3回） | ${fmt(verify.best)} | ${fmt(verify.mean)} | 盤面は軽いもの |`,
);
console.log(
  `| 見積もり: 検証1回の上限（理論上限 × 3 + 操作ログ） | — | ${fmt(theoretical * 3 + verify.mean)} | |`,
);
