/**
 * シフトの進行: 試運転・本番・次のシフトへの移行
 */
import type { ShiftSpec } from '../balance';
import { getShiftEconomy, getShiftRules } from '../config/bossModifiers';
import { drawBoss, type EconomyConfig } from '../config/runConfig';
import { isBlockedCell } from '../floor/layer';
import { generateStage } from '../floor/stage';
import { createPrng } from '../core/prng';
import { getPart, setPart } from '../core/board';
import {
  SCORE_ZERO,
  scoreAdd,
  scoreCompare,
  scoreFromString,
  scoreOf,
  scoreSub,
  scoreToString,
} from '../core/score';
import { simulate } from '../simulate/simulate';
import type { RuleSet, SimResult } from '../types';
import { applyEventEconomy, applyEventShift, drawDayEvent, isEventPending } from './events';
import { drawBonusFloor, getCurrentFloor } from './floor';
import { returnToHand } from './inventory';
import { expireItems } from './items';
import { applyRelicShift, drawRelicChoice, isRelicPending } from './relics';
import { commitSeed, overtimeSeed, shopSeed, stageSeed, trialSeed } from './seeds';
import { generateShop, permitForShift } from './shop';
import type { CommitResult, RunError, RunState, ShiftOutcome } from './types';

/** shiftIndex に入るとき、直前のシフトが夜（ボス）ならレリックの候補を出す */
function relicChoiceAfter(state: RunState, shiftIndex: number): RunState['relicChoice'] {
  const previous = state.config.shifts[shiftIndex - 1];
  if (!state.config.relics || previous?.kind !== 'boss') return null;
  const day = Math.floor((shiftIndex - 1) / state.config.shiftsPerDay);
  const choices = drawRelicChoice(state, day);
  return choices.length > 0 ? { day, choices } : null;
}

/** レリックを選んだ後の品揃え（選ぶまで買い物はできないので、同じシードで並べ直す） */
export function regenerateShop(state: RunState): RunState {
  return {
    ...state,
    shop: generateShop(
      shopSeed(state.seed, state.shiftIndex, state.rerollCount),
      getCurrentEconomy(state),
      permitForShift(state.config, state.shiftIndex),
    ),
  };
}

/** 現在のシフトの設定（ノルマ・予算・報酬・種類。今日のイベント・レリック込み） */
export function getCurrentShift(state: RunState): ShiftSpec {
  const spec = state.config.shifts[state.shiftIndex];
  if (!spec) throw new Error(`Invalid shift index: ${state.shiftIndex}`);
  const withEvent = applyEventShift(state, state.shiftIndex, spec);
  return state.config.relics
    ? applyRelicShift(withEvent, state.relics ?? [], state.config.relics.params)
    : withEvent;
}

export function getShiftCount(state: RunState): number {
  return state.config.shifts.length;
}

/** 何日目（0 始まり）の何シフト目（0=朝 1=昼 2=夜）か */
export function getDayAndPeriod(state: RunState, shiftIndex = state.shiftIndex) {
  const perDay = state.config.shiftsPerDay;
  return { day: Math.floor(shiftIndex / perDay), period: shiftIndex % perDay };
}

/** 現在のシフトで使うルール（ボス修正込み） */
export function getCurrentRules(state: RunState): RuleSet {
  return getShiftRules(state.config, state.shiftIndex, state.relics ?? []);
}

/** 現在のシフトで使う経済設定（ボス修正・今日のイベント込み） */
export function getCurrentEconomy(state: RunState): EconomyConfig {
  return applyEventEconomy(
    state,
    state.shiftIndex,
    getShiftEconomy(state.config, state.shiftIndex, state.relics ?? []),
  );
}

/**
 * 試運転: 現在の盤面でスイッチを押した結果を計算する。
 * 試運転ごとに異なるシードを使うため、ポンコツロボなどランダムな要素は毎回変わる。
 * 返す state は試運転回数が1増えただけで、盤面などは変わらない。
 */
export function runTrial(state: RunState): { state: RunState; result: SimResult } {
  const result = simulate({
    board: state.board,
    floor: getCurrentFloor(state),
    seed: trialSeed(state.seed, state.shiftIndex, state.trialCount),
    rules: getCurrentRules(state),
    hot: state.press?.hot ?? [],
  });
  return { state: { ...state, trialCount: state.trialCount + 1 }, result };
}

/**
 * スイッチを押してシフトを確定する（本番シードを使う）。
 * ノルマ達成なら報酬・収入と次シフトの予算を受け取り次へ（最終シフトならクリア）。未達ならラン終了。
 */
export function commitShift(
  state: RunState,
  options: { seed?: number } = {},
): CommitResult | { error: RunError } {
  if (state.phase !== 'building') return { error: 'notBuilding' };
  if (isEventPending(state)) return { error: 'eventNotChosen' };
  if (isRelicPending(state)) return { error: 'relicNotChosen' };

  // 週替わりは本番シードをサーバーから受け取る（クライアントでは計算できない）
  const pressIndex = state.press?.count ?? 0;
  let seed = options.seed;
  if (seed === undefined) {
    if (state.config.commitSeedMode === 'external') return { error: 'seedRequired' };
    seed = commitSeed(state.seed, state.shiftIndex, pressIndex);
  }

  const result = simulate({
    board: state.board,
    floor: getCurrentFloor(state),
    seed,
    rules: getCurrentRules(state),
    hot: state.press?.hot ?? [],
  });
  const spec = getCurrentShift(state);
  // 1シフトに何回も押せるときは、押した回の合計でノルマを目指す
  const perShift = Math.max(1, state.config.presses?.perShift ?? 1);
  const shipped = scoreAdd(
    state.press ? scoreFromString(state.press.shipped) : SCORE_ZERO,
    result.score,
  );
  const cleared = scoreCompare(shipped, scoreOf(spec.quota)) >= 0;
  const pressesLeft = perShift - (pressIndex + 1);

  // ノルマ未達で、まだ押せる: 同じシフトのまま次の回へ（収入はその場で予算に入る）
  if (!cleared && pressesLeft > 0) {
    const exempt = new Set(state.config.presses?.overheatExempt ?? []);
    const hot = hotCells(state, result).filter((cell) => {
      const part = state.board.cells[cell];
      return part ? !exempt.has(part.id) : false;
    });
    return {
      state: {
        ...state,
        budget: state.budget + result.income,
        press: { count: pressIndex + 1, shipped: scoreToString(shipped), hot },
      },
      result,
      outcome: {
        cleared: false,
        continues: true,
        shipped,
        quota: spec.quota,
        income: result.income,
        stats: result.stats,
      },
    };
  }

  const spareReward = cleared ? pressesLeft * (state.config.presses?.spareReward ?? 0) : 0;
  const outcome: ShiftOutcome = {
    cleared,
    shipped,
    spareReward,
    quota: spec.quota,
    income: result.income,
    stats: result.stats,
  };

  const history = [
    ...state.history,
    {
      shiftIndex: state.shiftIndex,
      score: scoreToString(shipped),
      quota: spec.quota,
      cleared,
      chainCount: result.stats.chainCount,
      income: result.income,
      boss: state.config.bossPlan[state.shiftIndex]?.id ?? null,
    },
  ];

  if (!cleared) return { state: { ...state, phase: 'failed', history }, result, outcome };

  const nextIndex = state.shiftIndex + 1;
  const carried = state.budget + spec.clearReward + result.income + spareReward;
  if (nextIndex >= getShiftCount(state)) {
    // 延長戦中は次のシフトを作って続ける。本編なら全シフトクリアで終了
    if (state.overtime) {
      const extended = appendOvertimeDay({ ...state, history }, nextIndex);
      return { state: enterShift(extended, nextIndex, carried), result, outcome };
    }
    // 延長戦に入ったときのために、繰り越す予算を残しておく
    return { state: { ...state, phase: 'cleared', history, budget: carried }, result, outcome };
  }

  // 残予算 + 報酬 + 収入 を持ち越して次のシフトへ
  return { state: enterShift({ ...state, history }, nextIndex, carried), result, outcome };
}

/**
 * ランを諦める（組み立て中だけ）。ノルマ未達と同じ「脱落」で終わる。
 * 確定済みのシフトの記録はそのまま残る（メタ進行には、確定したシフトの分だけが反映される）
 */
export function abandonRun(state: RunState): RunState | null {
  if (state.phase !== 'building') return null;
  return { ...state, phase: 'failed' };
}

/**
 * シフトを開始する（ラン開始時と、シフト移行時に使う）
 * - 予算を受け取り、ショップを並べ、リロール・試運転の回数をリセットする
 * - 2日目以降の朝（1日の最初のシフト）は、盤面のパーツをすべて手持ちへ戻し（resetBoardEachDay）、
 *   今日のイベントの候補を抽選する（dayEvents。選ぶのはプレイヤー: events.ts）
 * - 使用不可マス（ボス）に置かれたパーツは手持ちへ戻す
 */
export function enterShift(state: RunState, shiftIndex: number, carriedBudget: number): RunState {
  const spec = state.config.shifts[shiftIndex];
  if (!spec) throw new Error(`Invalid shift index: ${shiftIndex}`);

  const dayStart = isDayStart(state, shiftIndex);
  let next: RunState = {
    ...state,
    shiftIndex,
    budget: carriedBudget + spec.budget,
    rerollCount: 0,
    trialCount: 0,
    press: null,
    // 新しい日の朝は今日のイベントを抽選する（選ぶまでは効果なし）。同じ日のうちは前のシフトのまま
    dayEvent: dayStart
      ? drawDayEvent(state, Math.floor(shiftIndex / state.config.shiftsPerDay))
      : (state.dayEvent ?? null),
    // 夜（ボス）のシフトをクリアした次のシフトは、レリックの候補が出る
    relicChoice: relicChoiceAfter(state, shiftIndex),
  };
  // ショップは今日のイベント（特売日など）を反映した価格で並べる
  next = {
    ...next,
    shop: generateShop(
      shopSeed(state.seed, shiftIndex, 0),
      getCurrentEconomy(next),
      permitForShift(state.config, shiftIndex),
    ),
  };

  // 日が変わったら、使っていない配置権と、配置権で湧いた床を消す
  next = expireItems(next, shiftIndex);

  if (state.config.resetBoardEachDay && dayStart) {
    next = returnAllParts(next);
  }

  // 使用不可になったマス（ステージ・ボス）のパーツは手持ちに戻す
  const floor = getCurrentFloor({ ...next, bonusFloor: null }, shiftIndex);
  for (let cell = 0; cell < next.board.cells.length; cell++) {
    if (!isBlockedCell(floor, cell)) continue;
    const x = cell % next.board.width;
    const y = Math.floor(cell / next.board.width);
    const part = getPart(next.board, x, y);
    if (!part) continue;
    next = returnToHand({ ...next, board: setPart(next.board, x, y, null) }, part);
  }
  // シフト開始時のボーナス床（パーツを片付けた後の盤面で、空きマスに湧く）
  return { ...next, bonusFloor: drawBonusFloor(next, shiftIndex) };
}

/**
 * 1シフトに押せる回数の途中経過（画面の表示用）
 * perShift: 押せる回数（1 なら従来どおり）・used: 押した回数・shipped: ここまでの合計・
 * remaining: ノルマまであと（0 未満にはしない）・hot: 過熱しているマス
 */
export function getPressInfo(state: RunState) {
  const perShift = Math.max(1, state.config.presses?.perShift ?? 1);
  const used = state.press?.count ?? 0;
  const shipped = state.press ? scoreFromString(state.press.shipped) : SCORE_ZERO;
  const quota = scoreOf(getCurrentShift(state).quota);
  const remaining = scoreCompare(shipped, quota) >= 0 ? SCORE_ZERO : scoreSub(quota, shipped);
  return { perShift, used, shipped, remaining, hot: state.press?.hot ?? [] };
}

/** 本番で発動したマス（次の回に過熱する） */
function hotCells(state: RunState, result: SimResult): number[] {
  const cells = new Set<number>();
  for (const e of result.events) {
    if (e.type === 'activate') cells.add(e.y * state.board.width + e.x);
  }
  return [...cells].sort((a, b) => a - b);
}

/** 2日目以降の1日の最初のシフトか（ラン開始時の朝は含めない） */
export function isDayStart(state: RunState, shiftIndex: number): boolean {
  return shiftIndex > 0 && shiftIndex % state.config.shiftsPerDay === 0;
}

/** 盤面のパーツをすべて手持ちへ戻す */
function returnAllParts(state: RunState): RunState {
  let next: RunState = {
    ...state,
    board: { ...state.board, cells: state.board.cells.map(() => null) },
  };
  for (const part of state.board.cells) {
    if (part) next = returnToHand(next, part);
  }
  return next;
}

/**
 * 延長戦に入る（全シフトクリア後のみ）。シフトを1つ追加して続ける
 * ノルマは毎シフト overtime.quotaGrowthPercent% ずつ上がり、1日の最後のシフトはボスになる
 */
export function startOvertime(state: RunState): RunState | null {
  if (state.phase !== 'cleared' || state.overtime || !state.config.overtimeAllowed) return null;
  const extended = appendOvertimeDay(
    { ...state, overtime: true, phase: 'building' },
    state.shiftIndex + 1,
  );
  // cleared のとき budget には繰り越し分（残予算 + 報酬 + 収入）が入っている
  return enterShift(extended, state.shiftIndex + 1, state.budget);
}

/**
 * 延長戦のシフトを、shiftIndex を含む1日の終わりまでまとめて追加する（ノルマ・予算・ボス）。
 * 1日分を先に作っておくことで、夜のボスを朝・昼のうちから予告できる
 */
function appendOvertimeDay(state: RunState, shiftIndex: number): RunState {
  const perDay = state.config.shiftsPerDay;
  const dayEnd = (Math.floor(shiftIndex / perDay) + 1) * perDay;
  const shifts = [...state.config.shifts];
  const bossPlan = [...state.config.bossPlan];
  const { overtime, bossParams, board } = state.config;

  // その日のステージ（3日目の帯から抽選し、延長戦の日が進むほど×2床を×3床に置き換える）
  const day = Math.floor(shiftIndex / perDay);
  let stages = state.config.stages;
  if (stages && !stages.days[day]) {
    const overtimeDay = day - Math.ceil(state.config.baseShiftCount / perDay) + 1;
    const floor = generateStage({
      seed: stageSeed(state.seed, day),
      band: stages.balance.overtimeBand,
      board,
      stages: stages.balance,
      upgrades: Math.max(0, overtimeDay) * stages.balance.overtimeUpgradesPerDay,
    });
    const days = [...stages.days];
    days[day] = floor;
    stages = { ...stages, days };
  }

  while (shifts.length < dayEnd) {
    const index = shifts.length;
    const isBoss = (index + 1) % perDay === 0;
    shifts.push({
      quota: Math.floor((shifts[index - 1]!.quota * overtime.quotaGrowthPercent) / 100),
      budget: overtime.budget,
      clearReward: overtime.clearReward,
      kind: isBoss ? 'boss' : 'normal',
    });
    const previousBoss = [...bossPlan].reverse().find((b) => b)?.id ?? null;
    const rng = createPrng(overtimeSeed(state.seed, index));
    bossPlan.push(
      isBoss ? drawBoss(rng, bossParams, board, previousBoss, stages?.days[day]) : null,
    );
  }
  return { ...state, config: { ...state.config, shifts, bossPlan, stages } };
}
