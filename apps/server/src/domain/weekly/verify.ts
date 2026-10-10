/**
 * サーバー検証: 操作ログを最初から再生して、本番を実行する
 *
 * クライアントから受け取るのは操作ログだけ。盤面・予算・スコアは一切信用せず、
 * クライアントと同じ packages/sim の関数で再計算する（CLAUDE.md「サーバーは同じ simulate を実行して検証する」）。
 *
 * 不正な操作（予算オーバー・ショップにないパーツの購入・盤面外への配置など）は
 * sim の各操作関数が拒否するので、ここではその結果を見るだけでよい。
 */
import {
  applyOp,
  commitShift,
  createRunWithConfig,
  isRunOp,
  type CommitResult,
  type PartId,
  type RunConfig,
  type RunState,
} from '@chain-factory/sim';
import { SERVER_LIMITS } from '../../config/server';
import type { ShopStatRow } from '../../repositories/types';

export type VerifyFailure = { ok: false; reason: string };

/** 1シフト分の操作を適用した結果（ショップの提示・購入数の集計つき） */
export type ApplyShiftResult = { ok: true; state: RunState; stats: ShopStatRow[] } | VerifyFailure;

/**
 * 1シフト分の操作ログを適用する（本番の直前まで）。
 * 相場の材料として、このシフトで提示された商品と購入された商品を数える
 */
export function applyShiftOps(start: RunState, ops: unknown): ApplyShiftResult {
  if (!Array.isArray(ops)) return { ok: false, reason: 'opsNotArray' };
  if (ops.length > SERVER_LIMITS.maxOpsPerShift) return { ok: false, reason: 'tooManyOps' };

  const counts = new Map<PartId, ShopStatRow>();
  const count = (partId: PartId, field: 'offered' | 'bought') => {
    const row = counts.get(partId) ?? { partId, offered: 0, bought: 0 };
    row[field]++;
    counts.set(partId, row);
  };
  // 相場の材料はパーツだけ（消耗品の配置権は相場の対象外）
  const countShop = (s: RunState) =>
    s.shop.forEach((offer) => offer.partId && count(offer.partId, 'offered'));

  let state = start;
  countShop(state);
  for (let i = 0; i < ops.length; i++) {
    const op: unknown = ops[i];
    if (!isRunOp(op)) return { ok: false, reason: `op[${i}]:invalidOp` };
    const result = applyOp(state, op);
    if (!result.ok) return { ok: false, reason: `op[${i}]:${result.error}` };
    const bought = op.op === 'buy' ? state.shop[op.offerIndex]!.partId : undefined;
    if (bought) count(bought, 'bought');
    if (op.op === 'reroll') countShop(result.state);
    state = result.state;
  }
  return { ok: true, state, stats: [...counts.values()] };
}

/**
 * 確定済みのシフトを再生して、現在のシフトの開始状態を作る。
 * 保存済みの操作ログは検証済みなので、ここで失敗するのはデータ破損か sim の非互換（例外にする）
 */
export function rebuildState(
  runSeed: number,
  config: RunConfig,
  committedOps: readonly unknown[][],
  seeds: readonly number[],
): RunState {
  let state = createRunWithConfig(runSeed, config);
  committedOps.forEach((ops, shiftIndex) => {
    const applied = applyShiftOps(state, ops);
    if (!applied.ok)
      throw new Error(`stored ops replay failed: shift ${shiftIndex} ${applied.reason}`);
    const committed = commitShift(applied.state, { seed: seeds[shiftIndex]! });
    if ('error' in committed) throw new Error(`stored commit failed: ${committed.error}`);
    state = committed.state;
  });
  return state;
}

/** 新しいシフトの操作ログを適用し、本番シードで確定する */
export function verifyAndCommit(
  current: RunState,
  ops: unknown,
  seed: number,
): { ok: true; commit: CommitResult; stats: ShopStatRow[] } | VerifyFailure {
  const applied = applyShiftOps(current, ops);
  if (!applied.ok) return applied;
  const committed = commitShift(applied.state, { seed });
  if ('error' in committed) return { ok: false, reason: `commit:${committed.error}` };
  return { ok: true, commit: committed, stats: applied.stats };
}
