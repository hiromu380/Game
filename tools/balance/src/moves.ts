/**
 * ボットが選べる「手」の生成と適用
 *
 * 盤面のどこにでも置けるが、既存パーツから離れた場所に置いても連鎖には関わらないため、
 * 候補は「既存パーツの周囲8マス」に絞る（計算量を抑えるため）。
 * 加えて「出荷口の手前に割り込ませ、出荷口を1マス先へずらす」手も候補にする。
 * これがないと、一直線の連鎖にパーツを挿し込む手が見つけられない。
 */
import {
  buyOffer,
  getCurrentRules,
  getPart,
  getRerollCost,
  isInside,
  placePart,
  rerollShop,
  returnPart,
  type Dir4,
  type PartId,
  type RunState,
} from '@chain-factory/sim';

/** 向きが挙動に関係しないパーツ（候補を1方向に絞る） */
const DIRECTIONLESS = new Set<PartId>(['barrel', 'junkbot', 'dock', 'reflector', 'oiler']);
const DIRS: Dir4[] = [0, 1, 2, 3];
const DELTAS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/** パーツの置き方 */
export type Placement =
  | { type: 'cell'; x: number; y: number; dir: Dir4 }
  /** (x,y) の出荷口を dir 方向へ1マスずらし、空いた (x,y) に新しいパーツを dir 向きで置く */
  | { type: 'insert'; x: number; y: number; dir: Dir4 };

export type Move =
  /** 手持ちのスイッチを定位置に置く */
  | { kind: 'switch' }
  | { kind: 'place'; partId: PartId; placement: Placement }
  | { kind: 'buyPlace'; offerIndex: number; partId: PartId; placement: Placement }
  | { kind: 'reroll' }
  /** 盤面のパーツを手持ちに戻す（組み直し用） */
  | { kind: 'return'; x: number; y: number };

/**
 * 置くのを避けるマス: 今使えないマス＋同じ日の夜に工事で使えなくなるマス（予告は画面に出ているので、
 * プレイヤーと同じ情報でボットも避ける）
 */
function isBlocked(state: RunState, x: number, y: number): boolean {
  const index = y * state.board.width + x;
  if (getCurrentRules(state).blockedCells.includes(index)) return true;
  const perDay = state.config.shiftsPerDay;
  const dayEnd = (Math.floor(state.shiftIndex / perDay) + 1) * perDay;
  for (let i = state.shiftIndex + 1; i < dayEnd; i++) {
    if (state.config.bossPlan[i]?.blockedCells.includes(index)) return true;
  }
  return false;
}

function isFree(state: RunState, x: number, y: number): boolean {
  return isInside(state.board, x, y) && !getPart(state.board, x, y) && !isBlocked(state, x, y);
}

/** 既存パーツの周囲8マスのうち、置ける空きマス */
export function frontierCells(state: RunState): [number, number][] {
  const { board } = state;
  const result: [number, number][] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (!isFree(state, x, y)) continue;
      let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) {
        for (let dx = -1; dx <= 1 && !near; dx++) {
          if ((dx || dy) && getPart(board, x + dx, y + dy)) near = true;
        }
      }
      if (near) result.push([x, y]);
    }
  }
  return result;
}

/** そのパーツの置き方の候補 */
export function placementsFor(state: RunState, partId: PartId): Placement[] {
  const dirs = DIRECTIONLESS.has(partId) ? [0 as Dir4] : DIRS;
  const result: Placement[] = [];
  for (const [x, y] of frontierCells(state)) {
    for (const dir of dirs) result.push({ type: 'cell', x, y, dir });
  }
  // 出荷口の手前に割り込む（出荷口は置いたパーツの出力先へずらす）
  if (partId !== 'dock') {
    state.board.cells.forEach((cell, index) => {
      if (cell?.id !== 'dock') return;
      const x = index % state.board.width;
      const y = Math.floor(index / state.board.width);
      for (const dir of DIRS) {
        const [dx, dy] = DELTAS[dir]!;
        if (isFree(state, x + dx, y + dy)) result.push({ type: 'insert', x, y, dir });
      }
    });
  }
  return result;
}

/** 手持ちのパーツを置く。置けなければ null */
export function applyPlacement(
  state: RunState,
  partId: PartId,
  placement: Placement,
): RunState | null {
  if (placement.type === 'cell') {
    const r = placePart(state, partId, placement.x, placement.y, placement.dir);
    return r.ok ? r.state : null;
  }
  const { x, y, dir } = placement;
  const [dx, dy] = DELTAS[dir]!;
  const returned = returnPart(state, x, y);
  if (!returned.ok) return null;
  const moved = placePart(returned.state, 'dock', x + dx, y + dy, 0);
  if (!moved.ok) return null;
  const placed = placePart(moved.state, partId, x, y, dir);
  return placed.ok ? placed.state : null;
}

/** 手を適用する。適用できなければ null */
export function applyMove(state: RunState, move: Move): RunState | null {
  switch (move.kind) {
    case 'switch': {
      const placed = placeSwitch(state);
      return placed === state ? null : placed;
    }
    case 'place':
      return applyPlacement(state, move.partId, move.placement);
    case 'buyPlace': {
      const bought = buyOffer(state, move.offerIndex);
      return bought.ok ? applyPlacement(bought.state, move.partId, move.placement) : null;
    }
    case 'reroll': {
      const r = rerollShop(state);
      return r.ok ? r.state : null;
    }
    case 'return': {
      const r = returnPart(state, move.x, move.y);
      return r.ok ? r.state : null;
    }
  }
}

/** 今の状態で打てる手（配置系）をすべて列挙する */
export function listMoves(state: RunState): Move[] {
  const moves: Move[] = [];
  for (const partId of Object.keys(state.inventory) as PartId[]) {
    if (partId === 'switch') continue; // スイッチはボットの初期配置で扱う
    for (const placement of placementsFor(state, partId))
      moves.push({ kind: 'place', partId, placement });
  }
  const seenOffers = new Set<PartId>();
  state.shop.forEach((offer, offerIndex) => {
    // 同じパーツの売れ残りが複数あっても、評価は1回で十分
    if (offer.sold || offer.price > state.budget || seenOffers.has(offer.partId)) return;
    seenOffers.add(offer.partId);
    for (const placement of placementsFor(state, offer.partId)) {
      moves.push({ kind: 'buyPlace', offerIndex, partId: offer.partId, placement });
    }
  });
  return moves;
}

/** リロールできるか（予算を使い切らない範囲で） */
export function canReroll(state: RunState, reserve: number): boolean {
  const cost = getRerollCost(state);
  return cost !== null && state.budget >= cost + reserve;
}

/** スイッチを盤面の左端中央（右向き）に置く。使えなければ空いている左端のマス */
export function placeSwitch(state: RunState): RunState {
  if (!state.inventory.switch) return state;
  const { height } = state.board;
  const mid = Math.floor(height / 2);
  const rows = [mid, ...Array.from({ length: height }, (_, i) => i).filter((i) => i !== mid)];
  for (const y of rows) {
    for (let x = 0; x < state.board.width; x++) {
      if (!isFree(state, x, y) || !isFree(state, x + 1, y)) continue;
      const r = placePart(state, 'switch', x, y, 1);
      if (r.ok) return r.state;
    }
  }
  return state;
}
