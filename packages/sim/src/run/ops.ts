/**
 * 操作ログ: 組み立て中の操作（購入・リロール・配置・回転・手持ちに戻す・売却・今日のイベントの選択・消耗品の使用）を
 * 1手ずつ記録したもの
 *
 * 週替わりでは、クライアントはこの操作ログだけをサーバーへ送る。サーバーは同じラン進行関数で
 * 最初から再生し、予算・ショップ・盤面の整合性を確かめてから本番を実行する
 * （クライアントが送った盤面や予算そのものは信用しない）。
 * 試運転はランの状態を変えない（試運転回数だけ）ので、操作ログには含めない。
 */
import type { ItemId } from '../balance';
import { PART_IDS, type Dir4, type PartId } from '../types';
import { buyOffer, placePart, rerollShop, returnPart, rotatePart, sellPart } from './build';
import { chooseEvent, isEventPending } from './events';
import { useFloorPermit } from './items';
import type { RunActionResult, RunError, RunState } from './types';

export type RunOp =
  | { op: 'buy'; offerIndex: number }
  | { op: 'reroll' }
  | { op: 'place'; partId: PartId; x: number; y: number; dir: Dir4 }
  | { op: 'rotate'; x: number; y: number }
  | { op: 'return'; x: number; y: number }
  | { op: 'sell'; x: number; y: number }
  /** 今日のイベントを候補から選ぶ（2日目以降の朝。選ぶまでほかの操作はできない） */
  | { op: 'chooseEvent'; index: number }
  /** 消耗品を使う（ランダム配置権: 床が湧く位置と種類は sim が決めるので、位置は送らない） */
  | { op: 'useItem'; itemId: ItemId };

/** 操作を1つ適用する */
export function applyOp(state: RunState, op: RunOp): RunActionResult {
  if (op.op === 'chooseEvent') return chooseEvent(state, op.index);
  if (isEventPending(state)) return { ok: false, error: 'eventNotChosen' };
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
    case 'useItem':
      return useFloorPermit(state);
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

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);

function isPartId(value: unknown): value is PartId {
  return typeof value === 'string' && PART_IDS.some((id) => id === value);
}

/** 外部から届いた値が操作として正しい形か（値の範囲は各操作の関数で確かめる） */
export function isRunOp(value: unknown): value is RunOp {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  switch (v.op) {
    case 'buy':
      return isInt(v.offerIndex);
    case 'chooseEvent':
      return isInt(v.index);
    case 'reroll':
      return true;
    case 'place':
      return (
        isPartId(v.partId) &&
        isInt(v.x) &&
        isInt(v.y) &&
        (v.dir === 0 || v.dir === 1 || v.dir === 2 || v.dir === 3)
      );
    case 'rotate':
    case 'return':
    case 'sell':
      return isInt(v.x) && isInt(v.y);
    case 'useItem':
      return v.itemId === 'floorPermit';
    default:
      return false;
  }
}
