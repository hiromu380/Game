/**
 * ランの開始
 */
import { BALANCE, type Balance } from '../balance';
import { buildRunConfig, type MetaModifiers } from '../config/runConfig';
import { createEmptyBoard } from '../core/board';
import { bossSeed } from './seeds';
import { enterShift } from './shift';
import type { RunState } from './types';

export interface CreateRunOptions {
  balance?: Balance;
  /** メタ進行による変更（デイリーチャレンジでは渡さない） */
  meta?: MetaModifiers;
}

/** 新しいランを始める */
export function createRun(seed: number, options: CreateRunOptions = {}): RunState {
  const runSeed = seed >>> 0;
  const config = buildRunConfig({
    balance: options.balance ?? BALANCE,
    meta: options.meta,
    bossSeed: bossSeed(runSeed),
  });

  const initial: RunState = {
    seed: runSeed,
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
