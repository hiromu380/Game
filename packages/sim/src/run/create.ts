/**
 * ランの開始
 */
import { BALANCE, type Balance } from '../balance';
import { buildDailyConfig, dailyRunSeed } from '../config/daily';
import { buildRunConfig, type MetaModifiers, type RunConfig } from '../config/runConfig';
import { createEmptyBoard } from '../core/board';
import type { PartId } from '../types';
import { bossSeed } from './seeds';
import { enterShift } from './shift';
import type { RunState } from './types';

export interface CreateRunOptions {
  balance?: Balance;
  /** メタ進行による変更（デイリーチャレンジでは渡さない） */
  meta?: MetaModifiers;
  /** 相場価格（オンライン時に取得したもの。ラン開始時に RunConfig に固定する） */
  prices?: Partial<Record<PartId, number>>;
}

/** 新しい通常ランを始める */
export function createRun(seed: number, options: CreateRunOptions = {}): RunState {
  const runSeed = seed >>> 0;
  const config = buildRunConfig({
    balance: options.balance ?? BALANCE,
    meta: options.meta,
    bossSeed: bossSeed(runSeed),
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
 * デイリー（または練習）のランを始める
 * @param config サーバーから配布された RunConfig（デイリー本番）。省略時はその場で組み立てる（練習・テスト）
 */
export function createDailyRun(
  dailyId: string,
  options: { config?: RunConfig; practice?: boolean } = {},
): RunState {
  const config = options.config ?? buildDailyConfig({ dailyId, practice: options.practice });
  return createRunWithConfig(dailyRunSeed(dailyId), config);
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
  };
  return enterShift(initial, 0, 0);
}
