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
 *      - 盤面外 → 消滅 / 空マス → 消滅
 *      - パーツ → 発動回数が残っていれば発動（信号は消費される）、尽きていれば消滅
 *   3. 発動したパーツが出した信号は、次の tick から移動を始める
 */
import { cellIndex, getPart, isInside } from '../core/board';
import { dir4ToDir8, dir8Delta } from '../core/direction';
import { createPrng } from '../core/prng';
import { SCORE_ZERO, scoreAdd, scoreMax, scoreOf, type Score } from '../core/score';
import type { Dir8, SimEvent, SimInput, SimResult, Signal } from '../types';
import { PART_BEHAVIORS } from './parts';

export function simulate(input: SimInput): SimResult {
  const { board, seed, rules } = input;
  const rng = createPrng(seed);
  const events: SimEvent[] = [];

  // マスごとの発動済み回数
  const used = new Array<number>(board.cells.length).fill(0);
  // 1回でも発動したマス（統計用）
  const activatedCells = new Set<number>();

  let signals: Signal[] = [];
  let nextSignalId = 0;
  let score: Score = SCORE_ZERO;
  let maxValue: Score = SCORE_ZERO;
  let chainCount = 0;
  let shipCount = 0;

  /** 信号を1つ生成し、emit イベントを記録する */
  const emit = (tick: number, x: number, y: number, dir: Dir8, value: Score): Signal => {
    const signal: Signal = { id: nextSignalId++, x, y, dir, value };
    maxValue = scoreMax(maxValue, value);
    events.push({ tick, type: 'emit', signalId: signal.id, x, y, dir, value });
    return signal;
  };

  /** そのマスのパーツがまだ発動できるか */
  const canActivate = (index: number, limit: number | null): boolean =>
    limit === null || (used[index] ?? 0) < limit;

  // ---- tick 0: すべてのスイッチが発射（行優先の順） ----
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const part = getPart(board, x, y);
      if (part?.id !== 'switch') continue;
      const index = cellIndex(board, x, y);
      if (!canActivate(index, rules.maxActivations.switch)) continue;
      used[index] = (used[index] ?? 0) + 1;
      activatedCells.add(index);
      signals.push(emit(0, x, y, dir4ToDir8(part.dir), scoreOf(rules.switchSignalValue)));
    }
  }

  // ---- tick 1 以降: 信号の移動と反応 ----
  let tick = 0;
  while (signals.length > 0 && tick < rules.tickLimit) {
    tick++;
    const nextSignals: Signal[] = [];

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

      const part = getPart(board, x, y);
      if (part === null) {
        events.push({ tick, type: 'vanish', signalId: signal.id, x, y, reason: 'emptyCell' });
        continue;
      }

      const behavior = PART_BEHAVIORS[part.id];
      if (behavior.react === null) {
        events.push({ tick, type: 'vanish', signalId: signal.id, x, y, reason: 'inert' });
        continue;
      }

      const index = cellIndex(board, x, y);
      if (!canActivate(index, rules.maxActivations[part.id])) {
        events.push({ tick, type: 'vanish', signalId: signal.id, x, y, reason: 'exhausted' });
        continue;
      }

      // 発動
      used[index] = (used[index] ?? 0) + 1;
      activatedCells.add(index);
      chainCount++;
      events.push({ tick, type: 'activate', signalId: signal.id, x, y, partId: part.id });

      const reaction = behavior.react({
        part,
        x,
        y,
        value: signal.value,
        inDir: signal.dir,
        board,
        rules,
        rng,
      });

      if (reaction.ship !== undefined) {
        score = scoreAdd(score, reaction.ship);
        shipCount++;
        events.push({ tick, type: 'ship', x, y, value: reaction.ship, total: score });
      }
      for (const [rx, ry] of reaction.resets ?? []) {
        used[cellIndex(board, rx, ry)] = 0;
        events.push({ tick, type: 'reset', x: rx, y: ry });
      }
      for (const out of reaction.emits ?? []) {
        nextSignals.push(emit(tick, x, y, out.dir, out.value));
      }
    }

    signals = nextSignals;
  }

  return {
    score,
    events,
    stats: {
      chainCount,
      activatedParts: activatedCells.size,
      shipCount,
      maxValue,
      ticks: tick,
      haltedByTickLimit: signals.length > 0,
    },
  };
}
