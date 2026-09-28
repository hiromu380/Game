/**
 * 操作ログ: 組み立て中の操作（購入・リロール・配置・回転・手持ちに戻す・売却）を1手ずつ記録したもの
 *
 * デイリーでは、クライアントはこの操作ログだけをサーバーへ送る。サーバーは同じラン進行関数で
 * 最初から再生し、予算・ショップ・盤面の整合性を確かめてから本番を実行する
 * （クライアントが送った盤面や予算そのものは信用しない）。
 * 試運転はランの状態を変えない（試運転回数だけ）ので、操作ログには含めない。
 */
import type { Dir4, PartId } from '../types';
import { buyOffer, placePart, rerollShop, returnPart, rotatePart, sellPart } from './build';
import type { RunActionResult, RunError, RunState } from './types';

export type RunOp =
  | { op: 'buy'; offerIndex: number }
  | { op: 'reroll' }
  | { op: 'place'; partId: PartId; x: number; y: number; dir: Dir4 }
  | { op: 'rotate'; x: number; y: number }
  | { op: 'return'; x: number; y: number }
  | { op: 'sell'; x: number; y: number };

/** 操作を1つ適用する */
export function applyOp(state: RunState, op: RunOp): RunActionResult {
  switch (op.op) {
    case 'buy':
      return buyOffer(state, op.offerIndex);
    case 'reroll':
      return rerollShop(state);
    case 'place':
      return placePart(state, op.partId, op.x, op.y, op.dir);
    case 'rotate':
      return rotatePart(state, op.x, op.y);
    case 'return':
      return returnPart(state, op.x, op.y);
    case 'sell':
      return sellPart(state, op.x, op.y);
  }
}

export type ReplayResult =
  | { ok: true; state: RunState }
  /** index 番目の操作が不正だった（理由つき） */
  | { ok: false; index: number; error: RunError | 'invalidOp' };

/**
 * 操作ログを順に適用する。途中で1つでも不正な操作があれば、その位置と理由を返す。
 * 型の合わない操作（外部から届いた壊れたデータ）も invalidOp として拒否する
 */
export function replayOps(state: RunState, ops: readonly unknown[]): ReplayResult {
  let current = state;
  for (let index = 0; index < ops.length; index++) {
    const op = ops[index];
    if (!isRunOp(op)) return { ok: false, index, error: 'invalidOp' };
    const result = applyOp(current, op);
    if (!result.ok) return { ok: false, index, error: result.error };
    current = result.state;
  }
  return { ok: true, state: current };
}

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);

/** 外部から届いた値が操作として正しい形か（値の範囲は各操作の関数で確かめる） */
export function isRunOp(value: unknown): value is RunOp {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  switch (v.op) {
    case 'buy':
      return isInt(v.offerIndex);
    case 'reroll':
      return true;
    case 'place':
      return (
        typeof v.partId === 'string' &&
        isInt(v.x) &&
        isInt(v.y) &&
        [0, 1, 2, 3].includes(v.dir as number)
      );
    case 'rotate':
    case 'return':
    case 'sell':
      return isInt(v.x) && isInt(v.y);
    default:
      return false;
  }
}
