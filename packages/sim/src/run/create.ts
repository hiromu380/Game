/**
 * ランの開始
 */
import { BALANCE, type Balance } from '../balance';
import { buildWeeklyConfig, weeklyRunSeed } from '../config/weekly';
import { buildRunConfig, type MetaModifiers, type RunConfig } from '../config/runConfig';
import { createEmptyBoard } from '../core/board';
import type { PartId } from '../types';
import { bossSeed } from './seeds';
import { enterShift } from './shift';
import type { RunState } from './types';

export interface CreateRunOptions {
  balance?: Balance;
  /** メタ進行による変更（週替わりチャレンジでは渡さない） */
  meta?: MetaModifiers;
  /** 相場価格（オンライン時に取得したもの。ラン開始時に RunConfig に固定する） */
  prices?: Partial<Record<PartId, number>>;
  /** 初回ガイドのラン（1日目のステージを固定のテンプレートにする） */
  tutorial?: boolean;
}

/** 新しい通常ランを始める */
export function createRun(seed: number, options: CreateRunOptions = {}): RunState {
  const runSeed = seed >>> 0;
  const config = buildRunConfig({
    balance: options.balance ?? BALANCE,
    meta: options.meta,
    bossSeed: bossSeed(runSeed),
    runSeed,
    tutorial: options.tutorial,
  });
  const withPrices: RunConfig = options.prices
    ? {
        ...config,
        economy: { ...config.economy, prices: { ...config.economy.prices, ...options.prices } },
      }
    : config;
  return createRunWithConfig(runSeed, withPrices);
}

/**
 * 週替わりチャレンジ（または練習）のランを始める
 * @param options.config サーバーから配布された RunConfig（本番）。省略時はその場で組み立てる（練習・テスト）
 * @param options.candidate・fallback その週の盤面の候補番号・代替設定か（サーバーの週の情報。ランシードが変わる）
 */
export function createWeeklyRun(
  weekId: string,
  options: { config?: RunConfig; practice?: boolean; candidate?: number; fallback?: boolean } = {},
): RunState {
  const { candidate = 0, fallback = false, practice } = options;
  const config = options.config ?? buildWeeklyConfig({ weekId, candidate, fallback, practice });
  return createRunWithConfig(weeklyRunSeed(weekId, fallback ? -1 : candidate), config);
}

/** 確定済みの RunConfig からランを始める */
export function createRunWithConfig(seed: number, config: RunConfig): RunState {
  const initial: RunState = {
    seed: seed >>> 0,
    config,
    shiftIndex: 0,
    phase: 'building',
    budget: 0,
    board: createEmptyBoard(config.board.width, config.board.height),
    inventory: { ...config.starterKit },
    shop: [],
    rerollCount: 0,
    trialCount: 0,
    history: [],
    overtime: false,
    metaRecordedShifts: 0,
    items: [],
    itemFloors: null,
  };
  return enterShift(initial, 0, 0);
}
