/**
 * シミュレーション本体
 *
 * 原則（CLAUDE.md「3. シミュレーション仕様」）:
 * - 完全決定論: 同じ (board, seed, rules) なら必ず同じ結果
 * - 純粋関数: 描画・DOM・ネットワーク・時刻に依存しない
 * - 必ず停止: パーツの発動回数上限 + 全体の tick 上限 + 同時に存在できる信号数の上限で保証
 *
 * 1 tick の流れ:
 *   1. 生きている信号を id の昇順に1つずつ処理する（処理順を固定して決定論にする）
 *   2. 信号は進行方向の隣マスへ移動する
 *      - 盤面外 / 使用不可マス / 空マス → 消滅
 *      - パーツ → 発動回数が残っていれば発動（信号は消費される）、尽きていれば消滅
 *        発動するときは、パーツの反応より前に、そのマスの床の効果を値に適用する（floor イベント）
 *   3. tick の終わりに、合流するパーツ（合流炉）がまとめて処理する（マス番号の昇順）
 *      床の効果は、取り込んだ値を合算した値に1回だけ適用する
 *   4. 遅れて発射する予定の信号（コピー機の2発目など）のうち、この tick の分を発射する
 *   5. この tick に発射された信号は、次の tick から移動を始める
 */
import { DIR8_DX, DIR8_DY, dir4ToDir8 } from '../core/direction';
import { createPrng } from '../core/prng';
import { SCORE_ZERO, scoreAdd, scoreMax, scoreOf, type Score } from '../core/score';
import { FLOOR_BEHAVIORS } from '../floor/tiles';
import type { FloorCell } from '../floor/types';
import type { HaltReason, Part, SimEvent, SimInput, SimResult, Signal } from '../types';
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
  const { board, floor, seed, rules } = input;
  const rng = createPrng(seed);
  const events: SimEvent[] = [];

  // マスごとの発動回数の上限（常時効果込み）と、発動済み回数・パーツの状態
  const limits = computeActivationLimits(board, rules);
  const used = new Array<number>(board.cells.length).fill(0);
  const partState = new Array<number>(board.cells.length).fill(0);
  /** パーツが溜めている値（蓄電池）。使うパーツがあるときだけ作る */
  let partStored: Score[] | null = null;
  /** 一度でも発動したマスか（発動したパーツの数を数える） */
  const activated = new Array<boolean>(board.cells.length).fill(false);
  let activatedParts = 0;

  // 盤面と床はシミュレーション中に変わらないので、マスごとの情報を先に引いておく
  // （信号1本ごとに、座標の範囲確認や床・パーツの定義の引き直しをしない）
  const { width, height, cells } = board;
  const cellCount = cells.length;
  /** 使用不可のマスか */
  const blocked = new Array<boolean>(cellCount).fill(false);
  /** 値に効果のある床（なければ null） */
  const floorCells = new Array<FloorCell | null>(cellCount).fill(null);
  for (let index = 0; index < cellCount; index++) {
    const cell = floor?.[index] ?? null;
    if (!cell) continue;
    const behavior = FLOOR_BEHAVIORS[cell.tile];
    if (behavior.blocked) blocked[index] = true;
    if (behavior.apply) floorCells[index] = cell;
  }

  let signals: Signal[] = [];
  let pending: PendingEmission[] = [];
  let nextSignalId = 0;
  let score: Score = SCORE_ZERO;
  let income = 0;
  let maxValue: Score = SCORE_ZERO;
  let chainCount = 0;
  let shipCount = 0;
  let floorApplied = 0;

  /** 発動の直前に、そのマスの床の効果を値に適用する（効果がなければそのまま） */
  const applyFloor = (tick: number, x: number, y: number, value: Score): Score => {
    const cell = floorCells[y * width + x];
    if (!cell) return value;
    const after = FLOOR_BEHAVIORS[cell.tile].apply!(value, rules.floorParams);
    floorApplied++;
    maxValue = scoreMax(maxValue, after);
    events.push({ tick, type: 'floor', x, y, tile: cell.tile, before: value, after });
    return after;
  };

  const canActivate = (index: number): boolean => {
    const limit = limits[index];
    return limit === null || (used[index] ?? 0) < (limit ?? 0);
  };

  const markActivated = (index: number): void => {
    used[index] = (used[index] ?? 0) + 1;
    if (!activated[index]) {
      activated[index] = true;
      activatedParts++;
    }
  };

  /** 信号を1つ生成し、emit イベントを記録する */
  const emit = (tick: number, x: number, y: number, e: Emission): Signal => {
    const signal: Signal = { id: nextSignalId++, x, y, dir: e.dir, value: e.value };
    if (e.jump) signal.reach = 1 + e.jump;
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
    const { resets, emits } = reaction;
    if (resets) {
      for (let i = 0; i < resets.length; i++) {
        const rx = resets[i]![0];
        const ry = resets[i]![1];
        used[ry * width + rx] = 0;
        events.push({ tick, type: 'reset', x: rx, y: ry });
      }
    }
    if (reaction.nextState !== undefined) partState[y * width + x] = reaction.nextState;
    if (reaction.nextStored !== undefined) {
      partStored ??= new Array<Score>(cellCount).fill(SCORE_ZERO);
      partStored[y * width + x] = reaction.nextStored;
    }
    if (emits) {
      for (let i = 0; i < emits.length; i++) {
        const emission = emits[i]!;
        const delay = emission.delay ?? 0;
        if (delay > 0) pending.push({ tick: tick + delay, x, y, emission });
        else out.push(emit(tick, x, y, emission));
      }
    }
  };

  // ---- tick 0: すべてのスイッチが発射（行優先の順） ----
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = y * width + x;
      const part = cells[index];
      if (part?.id !== 'switch') continue;
      if (blocked[index] || !canActivate(index)) continue;
      markActivated(index);
      signals.push(
        emit(0, x, y, { dir: dir4ToDir8(part.dir), value: scoreOf(rules.switchSignalValue) }),
      );
    }
  }

  // ---- tick 1 以降: 信号の移動と反応 ----
  let tick = 0;
  let halted: HaltReason | null = null;
  while (signals.length > 0 || pending.length > 0) {
    if (tick >= rules.tickLimit) {
      halted = 'tickLimit';
      break;
    }
    if (signals.length + pending.length > rules.maxLiveSignals) {
      halted = 'signalLimit';
      break;
    }
    tick++;
    const nextSignals: Signal[] = [];
    /** この tick に信号を受けた合流パーツ（マス番号 → 取り込んだ値）。受けたときに初めて作る */
    let buffers: Map<number, CollectBuffer> | null = null;

    // signals は生成順（= id 昇順）に並んでいる
    for (let s = 0; s < signals.length; s++) {
      const signal = signals[s]!;
      const reach = signal.reach ?? 1;
      const x = signal.x + DIR8_DX[signal.dir]! * reach;
      const y = signal.y + DIR8_DY[signal.dir]! * reach;

      if (x < 0 || y < 0 || x >= width || y >= height) {
        events.push({ tick, type: 'vanish', signalId: signal.id, x, y, reason: 'outOfBoard' });
        continue;
      }
      events.push({ tick, type: 'move', signalId: signal.id, x, y });

      const index = y * width + x;
      if (blocked[index]) {
        events.push({ tick, type: 'vanish', signalId: signal.id, x, y, reason: 'blocked' });
        continue;
      }

      const part = cells[index] ?? null;
      if (part === null) {
        events.push({ tick, type: 'vanish', signalId: signal.id, x, y, reason: 'emptyCell' });
        continue;
      }

      const behavior = PART_BEHAVIORS[part.id];

      // 合流するパーツ: 同じ tick の2本目以降は取り込むだけ（発動回数は消費しない）
      if (behavior.collect) {
        buffers ??= new Map();
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

      // 発動（床の効果はパーツの反応より前に適用する）
      const value = applyFloor(tick, x, y, signal.value);
      const reaction = behavior.react({
        part,
        x,
        y,
        value,
        inDir: signal.dir,
        board,
        rules,
        rng,
        chainCount,
        state: partState[index] ?? 0,
        stored: partStored?.[index] ?? SCORE_ZERO,
      });
      markActivated(index);
      chainCount++;
      events.push({ tick, type: 'activate', signalId: signal.id, x, y, partId: part.id });
      applyReaction(tick, x, y, reaction, nextSignals);
    }

    // tick の終わり: 合流するパーツをマス番号の昇順に処理する
    const collected = buffers ? [...buffers.values()].sort((a, b) => a.index - b.index) : [];
    for (const buffer of collected) {
      // 床の効果は、取り込んだ値の合計に1回だけ適用する（効果のある床なら、合計した1本として渡す）
      const values =
        floorCells[buffer.index] !== null
          ? [applyFloor(tick, buffer.x, buffer.y, buffer.values.reduce(scoreAdd, SCORE_ZERO))]
          : buffer.values;
      const reaction = PART_BEHAVIORS[buffer.part.id].collect!({
        part: buffer.part,
        x: buffer.x,
        y: buffer.y,
        values,
        board,
        rules,
        rng,
        chainCount,
        state: partState[buffer.index] ?? 0,
      });
      applyReaction(tick, buffer.x, buffer.y, reaction, nextSignals);
    }

    // 遅れて発射する予定の信号のうち、この tick の分を発射する（登録順）
    if (pending.length > 0) {
      const later: PendingEmission[] = [];
      for (const p of pending) {
        if (p.tick === tick) nextSignals.push(emit(tick, p.x, p.y, p.emission));
        else later.push(p);
      }
      pending = later;
    }

    signals = nextSignals;
  }

  const remaining = signals.length + pending.length;
  if (halted) events.push({ tick, type: 'halt', reason: halted, remainingSignals: remaining });

  return {
    score,
    income,
    events,
    stats: {
      chainCount,
      activatedParts,
      shipCount,
      floorApplied,
      maxValue,
      ticks: tick,
      halted,
    },
  };
}
