/**
 * ボットに1ランを通しで遊ばせ、記録をとる
 */
import {
  BALANCE,
  commitShift,
  createInitialMeta,
  createPrng,
  createRun,
  metaToModifiers,
  getCurrentShift,
  PART_IDS,
  type PartId,
  type RunState,
} from '@chain-factory/sim';
import { BOTS, type BotName, type BotOptions } from './bots';
import type { EvalMode } from './evaluate';
import { applyMove } from './moves';

/** 1シフトの記録 */
export interface ShiftLog {
  shiftIndex: number;
  score: string;
  quota: number;
  cleared: boolean;
  boss: string | null;
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
}

function add(record: Partial<Record<PartId, number>>, id: PartId, n = 1) {
  record[id] = (record[id] ?? 0) + n;
}

export function playRun(seed: number, botName: BotName, options: RunnerOptions): RunLog {
  const started = performance.now();
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
    ms: 0,
  };

  // メタ進行: 初期解放のみ（初プレイ相当）か、やり込んだ状態（全パーツ解放・工場拡張も最大）
  const meta =
    options.unlock === 'initial'
      ? { meta: metaToModifiers(createInitialMeta()) }
      : { meta: { boardExpansion: BALANCE.meta.boardExpansions.length } };
  let state: RunState = createRun(seed, meta);
  while (state.phase === 'building') {
    for (const offer of state.shop) add(log.offered, offer.partId);

    const plan = bot.playShift(state, botOptions);

    // 打った手をなぞって、購入・リロールの記録をとる（ボットの結果と一致することも確認する）
    let replay = state;
    for (const move of plan.moves) {
      const next = applyMove(replay, move);
      if (!next) throw new Error(`再現できない手: ${JSON.stringify(move)} (seed=${seed})`);
      if (move.kind === 'buyPlace') add(log.bought, move.partId);
      if (move.kind === 'reroll') {
        log.rerolls++;
        for (const offer of next.shop) add(log.offered, offer.partId);
      }
      replay = next;
    }
    if (JSON.stringify(replay.board) !== JSON.stringify(plan.state.board)) {
      throw new Error(`ボットの盤面と再現した盤面が一致しない (seed=${seed})`);
    }

    for (const part of plan.state.board.cells) if (part) add(log.onBoard, part.id);

    const quota = getCurrentShift(plan.state).quota;
    const committed = commitShift(plan.state);
    if ('error' in committed) throw new Error(committed.error);
    const record = committed.state.history.at(-1)!;
    log.shifts.push({
      shiftIndex: record.shiftIndex,
      score: record.score,
      quota,
      cleared: record.cleared,
      boss: record.boss,
    });
    if (record.cleared) log.shiftsCleared++;
    state = committed.state;
  }

  log.cleared = state.phase === 'cleared';
  log.ms = performance.now() - started;
  return log;
}

export { PART_IDS };
