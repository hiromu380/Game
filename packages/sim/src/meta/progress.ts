/**
 * メタ進行の更新: 終わったランの実績を記録し、条件を満たした解放を行う（純粋関数）
 *
 * 解放条件と解放内容は balance.ts の meta に置く。
 * デイリーチャレンジ（フェーズ3）ではメタ進行を適用しないので、ここで作る MetaModifiers を渡さない。
 */
import { BALANCE, type Balance, type MetaCondition } from '../balance';
import type { MetaModifiers } from '../config/runConfig';
import { scoreAdd, scoreCompare, scoreFromString, scoreMax, scoreOf } from '../core/score';
import type { RunState } from '../run/types';
import type { PartId } from '../types';
import type { MetaProgress, MetaRecords } from './types';

/** ランの終了で新しく解放されたもの */
export type Unlock = { kind: 'part'; partId: PartId } | { kind: 'board'; level: number };

/** 解放条件を満たしているか */
export function isConditionMet(records: MetaRecords, condition: MetaCondition): boolean {
  switch (condition.kind) {
    case 'bestChain':
      return records.bestChain >= condition.value;
    case 'reachShift':
      return records.bestShiftReached + 1 >= condition.value;
    case 'bestShiftScore':
      return scoreCompare(scoreFromString(records.bestShiftScore), scoreOf(condition.value)) >= 0;
    case 'totalShipped':
      return scoreCompare(scoreFromString(records.totalShipped), scoreOf(condition.value)) >= 0;
    case 'runsPlayed':
      return records.runsPlayed >= condition.value;
    case 'clears':
      return records.clears >= condition.value;
  }
}

/** 条件の達成度（0〜1。解放状況の表示用） */
export function conditionProgress(records: MetaRecords, condition: MetaCondition): number {
  const ratio = (current: number) => Math.min(1, current / Math.max(1, condition.value));
  switch (condition.kind) {
    case 'bestChain':
      return ratio(records.bestChain);
    case 'reachShift':
      return ratio(records.bestShiftReached + 1);
    case 'bestShiftScore':
      return ratio(Number(scoreFromString(records.bestShiftScore)));
    case 'totalShipped':
      return ratio(Number(scoreFromString(records.totalShipped)));
    case 'runsPlayed':
      return ratio(records.runsPlayed);
    case 'clears':
      return ratio(records.clears);
  }
}

/** 終わったランの実績を記録に反映する */
export function recordRun(records: MetaRecords, run: RunState): MetaRecords {
  let totalShipped = scoreFromString(records.totalShipped);
  let bestShiftScore = scoreFromString(records.bestShiftScore);
  let bestChain = records.bestChain;
  for (const shift of run.history) {
    const score = scoreFromString(shift.score);
    totalShipped = scoreAdd(totalShipped, score);
    bestShiftScore = scoreMax(bestShiftScore, score);
    bestChain = Math.max(bestChain, shift.chainCount);
  }
  return {
    totalShipped: totalShipped.toString(),
    bestShiftScore: bestShiftScore.toString(),
    bestChain,
    bestShiftReached: Math.max(records.bestShiftReached, run.history.at(-1)?.shiftIndex ?? 0),
    runsPlayed: records.runsPlayed + 1,
    clears: records.clears + (run.phase === 'cleared' ? 1 : 0),
  };
}

/**
 * 終わったランをメタ進行に反映し、新しく解放されたものを返す
 * （進行中のランを渡した場合は何もしない）
 */
export function applyRunToMeta(
  meta: MetaProgress,
  run: RunState,
  balance: Balance = BALANCE,
): { meta: MetaProgress; unlocks: Unlock[] } {
  if (run.phase === 'building') return { meta, unlocks: [] };

  const records = recordRun(meta.records, run);
  const unlocks: Unlock[] = [];

  const unlockedParts = [...meta.unlockedParts];
  for (const { partId, condition } of balance.meta.partUnlocks) {
    if (unlockedParts.includes(partId) || !isConditionMet(records, condition)) continue;
    unlockedParts.push(partId);
    unlocks.push({ kind: 'part', partId });
  }

  let boardLevel = meta.boardLevel;
  while (
    boardLevel < balance.meta.boardExpansions.length &&
    isConditionMet(records, balance.meta.boardExpansions[boardLevel]!)
  ) {
    boardLevel++;
    unlocks.push({ kind: 'board', level: boardLevel });
  }

  return { meta: { unlockedParts, boardLevel, records }, unlocks };
}

/** メタ進行を、ラン開始時の設定（RunConfig の層）に変換する */
export function metaToModifiers(meta: MetaProgress): MetaModifiers {
  return { unlockedParts: meta.unlockedParts, boardExpansion: meta.boardLevel };
}
