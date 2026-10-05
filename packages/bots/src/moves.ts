/**
 * ボットが選べる「手」の生成と適用
 *
 * 盤面のどこにでも置けるが、既存パーツから離れた場所に置いても連鎖には関わらないため、
 * 候補は「既存パーツの周囲8マス」に絞る（計算量を抑えるため）。
 * 加えて「出荷口の手前に割り込ませ、出荷口を1マス先へずらす」手も候補にする。
 * これがないと、一直線の連鎖にパーツを挿し込む手が見つけられない。
 *
 * 床: 効果のある床（×2・加算・×3）は、既存パーツから2マス以内なら候補に加える。
 * スイッチは、右へ向かう列に効果のある床が多い行・位置に置く（MOVE_SETTINGS.floorAware で切り替え。
 * 「床を見ないボット」との比較に使う）
 */
import {
  buyOffer,
  getCurrentFloor,
  isCellBlocked,
  getPart,
  getRerollCost,
  isInside,
  placePart,
  rerollShop,
  returnPart,
  rotatePart,
  type Dir4,
  type FloorLayer,
  type PartId,
  type RunState,
} from '@chain-factory/sim';

/** 手の生成の設定（計測用に切り替える） */
export const MOVE_SETTINGS = {
  /** 床を見て置き場所の候補を広げ、スイッチの位置を選ぶか */
  floorAware: true,
};

/** 床の重み（スイッチの位置選び・候補の順に使う。効果が大きい床ほど重い） */
const FLOOR_WEIGHT: Record<string, number> = { double: 2, add: 1, triple: 3 };

/** 効果のある床か（使用不可は除く） */
const hasFloorEffect = (floor: FloorLayer, index: number) =>
  (FLOOR_WEIGHT[floor[index]?.tile ?? ''] ?? 0) > 0;

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
  | { kind: 'return'; x: number; y: number }
  /** 盤面のパーツを90度回す */
  | { kind: 'rotate'; x: number; y: number }
  /** 盤面のパーツを別の場所・向きへ移す（手持ちに戻して置き直す。どちらも無料） */
  | { kind: 'relocate'; x: number; y: number; partId: PartId; placement: Placement };

/**
 * 置くのを避けるマス: 今使えないマス＋同じ日の夜に工事で使えなくなるマス（予告は画面に出ているので、
 * プレイヤーと同じ情報でボットも避ける）
 */
function isBlocked(state: RunState, x: number, y: number): boolean {
  const index = y * state.board.width + x;
  if (isCellBlocked(state, index)) return true;
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

/** 既存パーツの周囲8マス（効果のある床なら2マス以内）のうち、置ける空きマス */
export function frontierCells(state: RunState): [number, number][] {
  const { board } = state;
  const floor = MOVE_SETTINGS.floorAware ? getCurrentFloor(state) : null;
  const result: [number, number][] = [];
  const nearPart = (x: number, y: number, range: number) => {
    for (let dy = -range; dy <= range; dy++) {
      for (let dx = -range; dx <= range; dx++) {
        if ((dx || dy) && getPart(board, x + dx, y + dy)) return true;
      }
    }
    return false;
  };
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (!isFree(state, x, y)) continue;
      const range = floor && hasFloorEffect(floor, y * board.width + x) ? 2 : 1;
      if (nearPart(x, y, range)) result.push([x, y]);
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
    case 'rotate': {
      const r = rotatePart(state, move.x, move.y);
      return r.ok ? r.state : null;
    }
    case 'relocate': {
      const r = returnPart(state, move.x, move.y);
      return r.ok ? applyPlacement(r.state, move.partId, move.placement) : null;
    }
  }
}

/** 盤面に置いてあるパーツ（スイッチ以外）の位置 */
function placedParts(state: RunState): { x: number; y: number; partId: PartId }[] {
  const result: { x: number; y: number; partId: PartId }[] = [];
  state.board.cells.forEach((part, index) => {
    if (!part || part.id === 'switch') return;
    result.push({
      x: index % state.board.width,
      y: Math.floor(index / state.board.width),
      partId: part.id,
    });
  });
  return result;
}

/**
 * 組み替えの手（回転・移動）をすべて列挙する。どちらも無料なので、評価が上がるなら打てる。
 * 移動先は「そのパーツを抜いた盤面」での置き場所の候補（既存パーツの周囲・出荷口の手前）
 */
export function listRearrangeMoves(state: RunState): Move[] {
  const moves: Move[] = [];
  for (const { x, y, partId } of placedParts(state)) {
    if (!DIRECTIONLESS.has(partId)) moves.push({ kind: 'rotate', x, y });
    const lifted = returnPart(state, x, y);
    if (!lifted.ok) continue;
    for (const placement of placementsFor(lifted.state, partId)) {
      if (placement.type === 'cell' && placement.x === x && placement.y === y) continue;
      moves.push({ kind: 'relocate', x, y, partId, placement });
    }
  }
  return moves;
}

/** 盤面のパーツ（スイッチ以外）をすべて手持ちに戻す（組み直しの起点）。戻すものがなければ null */
export function returnAll(state: RunState): { state: RunState; moves: Move[] } | null {
  let current = state;
  const moves: Move[] = [];
  for (const { x, y } of placedParts(state)) {
    const move: Move = { kind: 'return', x, y };
    const next = applyMove(current, move);
    if (next) {
      current = next;
      moves.push(move);
    }
  }
  return moves.length > 0 ? { state: current, moves } : null;
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
    // 消耗品（配置権）は置く手ではないので、ここでは扱わない（ボットの方針は bots/permit.ts）
    if (offer.partId === undefined) return;
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

/**
 * スイッチを右向きに置く。床を見るときは、右へ向かう列（使用不可の手前まで）に効果のある床が多い位置、
 * 同じなら中央に近い行・左の列。床を見ないときは、左端中央から順に空いているマス
 */
export function placeSwitch(state: RunState): RunState {
  if (!state.inventory.switch) return state;
  const { width, height } = state.board;
  const mid = Math.floor(height / 2);
  const rows = [mid, ...Array.from({ length: height }, (_, i) => i).filter((i) => i !== mid)];
  const floor = MOVE_SETTINGS.floorAware ? getCurrentFloor(state) : null;
  let best: { x: number; y: number; score: number } | null = null;
  for (const y of rows) {
    for (let x = 0; x < width; x++) {
      if (!isFree(state, x, y) || !isFree(state, x + 1, y)) continue;
      if (!floor) return placeOrKeep(state, x, y);
      let score = 0;
      for (let fx = x + 1; fx < width && isFree(state, fx, y); fx++) {
        score += FLOOR_WEIGHT[floor[y * width + fx]?.tile ?? ''] ?? 0;
      }
      if (!best || score > best.score) best = { x, y, score };
    }
  }
  return best ? placeOrKeep(state, best.x, best.y) : state;
}

function placeOrKeep(state: RunState, x: number, y: number): RunState {
  const r = placePart(state, 'switch', x, y, 1);
  return r.ok ? r.state : state;
}
