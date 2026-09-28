/**
 * シミュレーション本体
 *
 * 原則（CLAUDE.md「3. シミュレーション仕様」）:
 * - 完全決定論: 同じ (board, seed, rules) なら必ず同じ結果
 * - 純粋関数: 描画・DOM・ネットワーク・時刻に依存しない
 * - 必ず停止: パーツの発動回数上限 + 全体の tick 上限で保証
 *
 * 1 tick の流れ:
 *   1. 生きている信号を id の昇順に1つずつ処理する（処理順を固定して決定論にする）
 *   2. 信号は進行方向の隣マスへ移動する
 *      - 盤面外 / 使用不可マス / 空マス → 消滅
 *      - パーツ → 発動回数が残っていれば発動（信号は消費される）、尽きていれば消滅
 *   3. tick の終わりに、合流するパーツ（合流炉）がまとめて処理する（マス番号の昇順）
 *   4. 遅れて発射する予定の信号（コピー機の2発目など）のうち、この tick の分を発射する
 *   5. この tick に発射された信号は、次の tick から移動を始める
 */
import { cellIndex, getPart, isInside } from '../core/board';
import { dir4ToDir8, dir8Delta } from '../core/direction';
import { createPrng } from '../core/prng';
import { SCORE_ZERO, scoreAdd, scoreMax, scoreOf, type Score } from '../core/score';
import type { Part, SimEvent, SimInput, SimResult, Signal } from '../types';
import { computeActivationLimits } from './limits';
import { PART_BEHAVIORS } from './parts';
import type { Emission, Reaction } from './parts/types';

/** 遅れて発射する予定の信号 */
interface PendingEmission {
  tick: number;
  x: number;
  y: number;
  emission: Emission;
}

/** 合流するパーツが、この tick に受けた信号 */
interface CollectBuffer {
  index: number;
  x: number;
  y: number;
  part: Part;
  values: Score[];
}

export function simulate(input: SimInput): SimResult {
  const { board, seed, rules } = input;
  const rng = createPrng(seed);
  const events: SimEvent[] = [];

  // マスごとの発動回数の上限（常時効果込み）と、発動済み回数・パーツの状態
  const limits = computeActivationLimits(board, rules);
  const used = new Array<number>(board.cells.length).fill(0);
  const partState = new Array<number>(board.cells.length).fill(0);
  const activatedCells = new Set<number>();

  let signals: Signal[] = [];
  let pending: PendingEmission[] = [];
  let nextSignalId = 0;
  let score: Score = SCORE_ZERO;
  let income = 0;
  let maxValue: Score = SCORE_ZERO;
  let chainCount = 0;
  let shipCount = 0;

  const canActivate = (index: number): boolean => {
    const limit = limits[index];
    return limit === null || (used[index] ?? 0) < (limit ?? 0);
  };

  const markActivated = (index: number): void => {
    used[index] = (used[index] ?? 0) + 1;
    activatedCells.add(index);
  };

  /** 信号を1つ生成し、emit イベントを記録する */
  const emit = (tick: number, x: number, y: number, e: Emission): Signal => {
    const signal: Signal = { id: nextSignalId++, x, y, dir: e.dir, value: e.value };
    maxValue = scoreMax(maxValue, e.value);
    events.push({ tick, type: 'emit', signalId: signal.id, x, y, dir: e.dir, value: e.value });
    return signal;
  };

  /** パーツの反応結果（出荷・収入・リセット・状態・発射）を反映する */
  const applyReaction = (
    tick: number,
    x: number,
    y: number,
    reaction: Reaction,
    out: Signal[],
  ): void => {
    const index = cellIndex(board, x, y);
    if (reaction.ship !== undefined) {
      score = scoreAdd(score, reaction.ship);
      shipCount++;
      events.push({ tick, type: 'ship', x, y, value: reaction.ship, total: score });
    }
    if (reaction.income !== undefined) {
      const amount = Math.min(reaction.income, rules.maxIncomePerSim - income);
      if (amount > 0) {
        income += amount;
        events.push({ tick, type: 'income', x, y, amount, total: income });
      }
    }
    for (const [rx, ry] of reaction.resets ?? []) {
      used[cellIndex(board, rx, ry)] = 0;
      events.push({ tick, type: 'reset', x: rx, y: ry });
    }
    if (reaction.nextState !== undefined) partState[index] = reaction.nextState;
    for (const emission of reaction.emits ?? []) {
      const delay = emission.delay ?? 0;
      if (delay > 0) pending.push({ tick: tick + delay, x, y, emission });
      else out.push(emit(tick, x, y, emission));
    }
  };

  // ---- tick 0: すべてのスイッチが発射（行優先の順） ----
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const part = getPart(board, x, y);
      if (part?.id !== 'switch') continue;
      const index = cellIndex(board, x, y);
      if (rules.blockedCells.includes(index) || !canActivate(index)) continue;
      markActivated(index);
      signals.push(
        emit(0, x, y, { dir: dir4ToDir8(part.dir), value: scoreOf(rules.switchSignalValue) }),
      );
    }
  }

  // ---- tick 1 以降: 信号の移動と反応 ----
  let tick = 0;
  while ((signals.length > 0 || pending.length > 0) && tick < rules.tickLimit) {
    tick++;
    const nextSignals: Signal[] = [];
    /** この tick に信号を受けた合流パーツ（マス番号 → 取り込んだ値） */
    const buffers = new Map<number, CollectBuffer>();

    // signals は生成順（= id 昇順）に並んでいる
    for (const signal of signals) {
      const [dx, dy] = dir8Delta(signal.dir);
      const x = signal.x + dx;
      const y = signal.y + dy;

      if (!isInside(board, x, y)) {
        events.push({ tick, type: 'vanish', signalId: signal.id, x, y, reason: 'outOfBoard' });
        continue;
      }
      events.push({ tick, type: 'move', signalId: signal.id, x, y });

      const index = cellIndex(board, x, y);
      if (rules.blockedCells.includes(index)) {
        events.push({ tick, type: 'vanish', signalId: signal.id, x, y, reason: 'blocked' });
        continue;
      }

      const part = getPart(board, x, y);
      if (part === null) {
        events.push({ tick, type: 'vanish', signalId: signal.id, x, y, reason: 'emptyCell' });
        continue;
      }

      const behavior = PART_BEHAVIORS[part.id];

      // 合流するパーツ: 同じ tick の2本目以降は取り込むだけ（発動回数は消費しない）
      if (behavior.collect) {
        const buffer = buffers.get(index);
        if (buffer) {
          buffer.values.push(signal.value);
          events.push({ tick, type: 'absorb', signalId: signal.id, x, y });
          continue;
        }
        if (!canActivate(index)) {
          events.push({ tick, type: 'vanish', signalId: signal.id, x, y, reason: 'exhausted' });
          continue;
        }
        markActivated(index);
        chainCount++;
        events.push({ tick, type: 'activate', signalId: signal.id, x, y, partId: part.id });
        buffers.set(index, { index, x, y, part, values: [signal.value] });
        continue;
      }

      if (behavior.react === null) {
        events.push({ tick, type: 'vanish', signalId: signal.id, x, y, reason: 'inert' });
        continue;
      }
      if (!canActivate(index)) {
        events.push({ tick, type: 'vanish', signalId: signal.id, x, y, reason: 'exhausted' });
        continue;
      }

      // 発動
      const reaction = behavior.react({
        part,
        x,
        y,
        value: signal.value,
        inDir: signal.dir,
        board,
        rules,
        rng,
        chainCount,
        state: partState[index] ?? 0,
      });
      markActivated(index);
      chainCount++;
      events.push({ tick, type: 'activate', signalId: signal.id, x, y, partId: part.id });
      applyReaction(tick, x, y, reaction, nextSignals);
    }

    // tick の終わり: 合流するパーツをマス番号の昇順に処理する
    for (const buffer of [...buffers.values()].sort((a, b) => a.index - b.index)) {
      const reaction = PART_BEHAVIORS[buffer.part.id].collect!({
        part: buffer.part,
        x: buffer.x,
        y: buffer.y,
        values: buffer.values,
        board,
        rules,
        rng,
        chainCount,
        state: partState[buffer.index] ?? 0,
      });
      applyReaction(tick, buffer.x, buffer.y, reaction, nextSignals);
    }

    // 遅れて発射する予定の信号のうち、この tick の分を発射する（登録順）
    const due = pending.filter((p) => p.tick === tick);
    pending = pending.filter((p) => p.tick !== tick);
    for (const p of due) nextSignals.push(emit(tick, p.x, p.y, p.emission));

    signals = nextSignals;
  }

  const remaining = signals.length + pending.length;
  if (remaining > 0) {
    events.push({ tick, type: 'halt', reason: 'tickLimit', remainingSignals: remaining });
  }

  return {
    score,
    income,
    events,
    stats: {
      chainCount,
      activatedParts: activatedCells.size,
      shipCount,
      maxValue,
      ticks: tick,
      haltedByTickLimit: remaining > 0,
    },
  };
}
