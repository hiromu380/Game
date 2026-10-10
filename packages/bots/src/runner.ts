/**
 * ボットに1ランを通しで遊ばせ、記録をとる
 */
import { nowMs } from './clock';
import {
  BALANCE,
  commitShift,
  createWeeklyRun,
  createInitialMeta,
  createPrng,
  createRun,
  metaToModifiers,
  countItems,
  getCurrentFloor,
  getCurrentShift,
  PART_IDS,
  type PartId,
  type RunState,
  chooseEvent,
  isEventPending,
  startOvertime,
} from '@chain-factory/sim';
import { BOTS, type Bot, type BotName, type BotOptions } from './bots';
import { evaluate, type EvalMode } from './evaluate';
import { applyMove, MOVE_SETTINGS } from './moves';
import { playGolden, type GoldenLog } from './golden';
import { playPermits, type PermitLog } from './permit';

/** 1シフトの記録 */
export interface ShiftLog {
  shiftIndex: number;
  score: string;
  quota: number;
  cleared: boolean;
  boss: string | null;
  /** ボット自身の見込み（本番前に評価した出荷量）。判断の甘さの分析用 */
  expected: string;
  /** 本番時の盤面にポンコツロボ（ランダムな挙動）があったか */
  junkbot: boolean;
  /** 本番時の残り予算 */
  budgetLeft: number;
  /** 本番時に盤面にあったパーツの数 */
  parts: number;
  /** その日の出来事（2日目以降。その日のどのシフトにも同じ値を入れる） */
  event: string | null;
  /** その日の出来事の候補 */
  eventChoices: string[] | null;
  chainCount: number;
  /** 本番時の、効果のある床（×2・加算・×3）のマス数 */
  floorCells: number;
  /** そのうちパーツを置いたマス数 */
  partsOnFloor: number;
  /** 本番で床の効果を受けた回数 */
  floorApplied: number;
}

/** 1ランの記録 */
export interface RunLog {
  seed: number;
  bot: BotName;
  /** ノルマを達成したシフト数 */
  shiftsCleared: number;
  cleared: boolean;
  shifts: ShiftLog[];
  /** パーツ別: ショップに並んだ回数（リロール分を含む） */
  offered: Partial<Record<PartId, number>>;
  /** パーツ別: 購入した回数 */
  bought: Partial<Record<PartId, number>>;
  /** パーツ別: 本番時に盤面にあった数（シフトごとに足し合わせる） */
  onBoard: Partial<Record<PartId, number>>;
  rerolls: number;
  /** ランダム配置権: 並んだ・買った・使った枚数、使わずに消えた枚数、湧いた床の種類 */
  permits: PermitLog & { expired: number };
  /** 金色パーツ: 合体した回数・手持ちの金色パーツを置いた回数 */
  golden: GoldenLog;
  ms: number;
}

export interface RunnerOptions {
  /** initial: 初めて遊ぶ人と同じ（初期解放パーツのみ・7×7）／ all: やり込んだ状態（全パーツ解放・工場拡張も最大） */
  unlock: 'initial' | 'all';
  samples: number;
  /** ランダムな盤面の評価のまとめ方（mean: 平均 / worst: 最悪の回） */
  evalMode: EvalMode;
  timeLimitMs: number;
  maxRerolls: number;
  /**
   * normal: 通常ラン（9シフト）／ weekly: 週替わりチャレンジと同じ条件（3シフト・全パーツ・7×7・今週の特殊ルール）。
   * weekly のシード n は「週の ID = bal-<n>」の週として遊ぶ（本番シードは練習モードと同じくクライアント側で作る）
   */
  mode?: 'normal' | 'weekly';
  /** 指定した状態から遊ぶ（サーバーの週の盤面の検証。mode・unlock より優先） */
  start?: RunState;
  /** 本番シードを外から渡す（commitSeedMode が external の設定を遊ぶとき） */
  commitSeed?: (shiftIndex: number) => number;
  /** ボットが床を見て手を選ぶか（既定 true。false は「床を見ないボット」との比較用。moves.ts） */
  floorAware?: boolean;
  /** ボットがランダム配置権を買って使うか（既定 true。false は「配置権を使わないボット」との比較用） */
  permits?: boolean;
  /** ボットが金色パーツを合体・配置するか（既定 true。false は比較用。golden.ts） */
  golden?: boolean;
  /** 全シフトをクリアしたら延長戦に入り、最大この日数まで続ける（既定 0: 延長戦に入らない） */
  overtimeDays?: number;
}

function add(record: Partial<Record<PartId, number>>, id: PartId, n = 1) {
  record[id] = (record[id] ?? 0) + n;
}

/** 今日の出来事の候補を1つずつ試し、その朝の見込みがいちばん良いものを選んだ状態を返す */
function chooseBestEvent(state: RunState, bot: Bot, options: BotOptions): RunState {
  let best: { state: RunState; ratio: number; budget: number } | null = null;
  const count = state.dayEvent?.choices.length ?? 0;
  for (let i = 0; i < count; i++) {
    const chosen = chooseEvent(state, i);
    if (!chosen.ok) continue;
    const plan = bot.playShift(chosen.state, options);
    const quota = getCurrentShift(plan.state).quota;
    const score = evaluate(plan.state, options.samples, options.evalMode).score;
    // 大きな数どうしの比なので、桁を落としてから割る
    const ratio = Number((score * 1000n) / BigInt(Math.max(1, quota))) / 1000;
    if (!best || ratio > best.ratio || (ratio === best.ratio && plan.state.budget > best.budget)) {
      best = { state: chosen.state, ratio, budget: plan.state.budget };
    }
  }
  if (!best) throw new Error('今日の出来事を選べない');
  return best.state;
}

export function playRun(seed: number, botName: BotName, options: RunnerOptions): RunLog {
  const started = nowMs();
  MOVE_SETTINGS.floorAware = options.floorAware ?? true;
  const bot = BOTS[botName];
  const botOptions: BotOptions = { ...options, rng: createPrng(seed ^ 0x5eed) };
  const log: RunLog = {
    seed,
    bot: botName,
    shiftsCleared: 0,
    cleared: false,
    shifts: [],
    offered: {},
    bought: {},
    onBoard: {},
    rerolls: 0,
    permits: { offered: 0, bought: 0, used: 0, expired: 0, tiles: {} },
    golden: { merged: 0, placed: 0 },
    ms: 0,
  };

  // メタ進行: 初期解放のみ（初プレイ相当）か、やり込んだ状態（全パーツ解放・工場拡張も最大）
  const meta =
    options.unlock === 'initial'
      ? { meta: metaToModifiers(createInitialMeta()) }
      : { meta: { boardExpansion: BALANCE.meta.boardExpansions.length } };
  let state: RunState = options.start
    ? options.start
    : options.mode === 'weekly'
      ? createWeeklyRun(`bal-${seed}`, { practice: true })
      : createRun(seed, meta);
  const overtimeEnd =
    state.config.shifts.length + (options.overtimeDays ?? 0) * state.config.shiftsPerDay;
  for (;;) {
    if (state.phase === 'cleared' && (options.overtimeDays ?? 0) > 0) {
      state = startOvertime(state) ?? state;
    }
    if (state.phase !== 'building' || state.shiftIndex >= overtimeEnd) break;
    // 今日の出来事（2日目以降の朝）: 候補ごとにその朝の手を考えてみて、ノルマに対する出荷量の見込みが
    // いちばん良いものを選ぶ（同じなら予算が多く残るもの）。朝のノルマ・価格・予算に効く出来事を正しく比べるため
    if (isEventPending(state)) state = chooseBestEvent(state, bot, botOptions);
    for (const offer of state.shop) if (offer.partId) add(log.offered, offer.partId);

    const plan = bot.playShift(state, botOptions);

    // 打った手をなぞって、購入・リロールの記録をとる（ボットの結果と一致することも確認する）
    let replay = state;
    for (const move of plan.moves) {
      const next = applyMove(replay, move);
      if (!next) throw new Error(`再現できない手: ${JSON.stringify(move)} (seed=${seed})`);
      if (move.kind === 'buyPlace') add(log.bought, move.partId);
      if (move.kind === 'reroll') {
        log.rerolls++;
        for (const offer of next.shop) if (offer.partId) add(log.offered, offer.partId);
      }
      replay = next;
    }
    if (JSON.stringify(replay.board) !== JSON.stringify(plan.state.board)) {
      throw new Error(`ボットの盤面と再現した盤面が一致しない (seed=${seed})`);
    }

    for (const part of plan.state.board.cells) if (part) add(log.onBoard, part.id);

    const quota = getCurrentShift(plan.state).quota;
    const expected = evaluate(plan.state, botOptions.samples, botOptions.evalMode).score;
    // 金色パーツ（組み立て後に、見込みが増えるときだけ置く・合体する。golden.ts）
    const golden =
      (options.golden ?? true)
        ? playGolden(plan.state, botOptions.samples, botOptions.evalMode, log.golden)
        : plan.state;
    // ランダム配置権（組み立て後に、期待値で買う・使う。結果は先読みしない。permit.ts）
    const built =
      (options.permits ?? true)
        ? playPermits(golden, botOptions.samples, botOptions.evalMode, log.permits)
        : golden;
    // 今日の最後のシフトで使わずに残った配置権は、日が変わると消える
    if ((built.shiftIndex + 1) % built.config.shiftsPerDay === 0) {
      log.permits.expired += countItems(built, 'floorPermit');
    }
    plan.state = built;
    const floor = getCurrentFloor(plan.state);
    const effectCells = floor.flatMap((c, i) => (c && c.tile !== 'blocked' ? [i] : []));
    const committed = commitShift(
      plan.state,
      options.commitSeed ? { seed: options.commitSeed(plan.state.shiftIndex) } : undefined,
    );
    if ('error' in committed) throw new Error(committed.error);
    const record = committed.state.history.at(-1)!;
    const dayEvent = plan.state.dayEvent ?? null;
    log.shifts.push({
      shiftIndex: record.shiftIndex,
      score: record.score,
      quota,
      cleared: record.cleared,
      boss: record.boss,
      expected: expected.toString(),
      junkbot: plan.state.board.cells.some((c) => c?.id === 'junkbot'),
      budgetLeft: plan.state.budget,
      parts: plan.state.board.cells.filter(Boolean).length,
      event: dayEvent?.chosen ?? null,
      eventChoices: dayEvent ? [...dayEvent.choices] : null,
      chainCount: record.chainCount,
      floorCells: effectCells.length,
      partsOnFloor: effectCells.filter((i) => plan.state.board.cells[i]).length,
      floorApplied: committed.result.stats.floorApplied,
    });
    if (record.cleared) log.shiftsCleared++;
    state = committed.state;
  }

  log.cleared =
    state.phase === 'cleared' || (state.overtime === true && state.phase === 'building');
  log.ms = nowMs() - started;
  return log;
}

export { PART_IDS };
