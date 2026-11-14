/**
 * ボットのランダム配置権の扱い（結果を先読みしない。期待値で決める）
 *
 * 組み立てを終えた盤面で、配置権を1枚使ったときに床が湧きうるマス（今のシフトの床がなく、その日のうちに
 * 工事・ステージの床もないマス）すべてと、床の種類の重みについて出荷量の見込みを計算し、その重み付き平均が
 * 今の見込みより大きければ「使う価値がある」とする。実際にどこへ湧くか（抽選の結果）は見ない。
 * 買うのは、使う価値があり、組み立てで余った予算で買えるとき（パーツの購入を優先する）
 */
import {
  buyOffer,
  countItems,
  getCurrentFloor,
  getShiftFloor,
  useFloorPermit,
  type FloorTileId,
  type RunState,
} from '@chain-factory/sim';
import { evaluate, type EvalMode } from './evaluate';

export interface PermitLog {
  offered: number;
  bought: number;
  used: number;
  tiles: Partial<Record<FloorTileId, number>>;
}

/** 配置権を1枚使ったときの、出荷量の見込みの増え方（湧きうるマスと種類の重みの平均。結果は見ない） */
export function expectedPermitGain(state: RunState, samples: number, mode: EvalMode): number {
  const params = state.config.floorPermit;
  if (!params) return 0;
  const perDay = state.config.shiftsPerDay;
  const day = Math.floor(state.shiftIndex / perDay);
  const floor = getCurrentFloor(state);
  const avoid = new Set<number>();
  for (let s = day * perDay; s < (day + 1) * perDay && s < state.config.shifts.length; s++) {
    getShiftFloor(state.config, s).forEach((c, i) => c && avoid.add(i));
  }
  const cells = floor.flatMap((c, i) => (c === null && !avoid.has(i) ? [i] : []));
  const weights = params.tileWeights.filter((w) => day >= (w.fromDay ?? 0));
  const totalWeight = weights.reduce((n, w) => n + w.weight, 0);
  if (cells.length === 0 || totalWeight <= 0) return 0;

  const base = Number(evaluate(state, samples, mode).score);
  let sum = 0;
  for (const index of cells) {
    for (const w of weights) {
      const previous = state.itemFloors?.day === day ? state.itemFloors.cells : [];
      const trial: RunState = {
        ...state,
        itemFloors: { day, cells: [...previous, { index, tile: w.tile }] },
      };
      sum += (Number(evaluate(trial, samples, mode).score) - base) * w.weight;
    }
  }
  return sum / (cells.length * totalWeight);
}

/** 組み立て後の盤面で、配置権を買う・使う（使う価値があるあいだ） */
export function playPermits(
  state: RunState,
  samples: number,
  mode: EvalMode,
  log: PermitLog,
): RunState {
  let current = state;
  log.offered += current.shop.filter((o) => o.itemId === 'floorPermit').length;
  for (let guard = 0; guard < 10; guard++) {
    if (expectedPermitGain(current, samples, mode) <= 0) break;
    if (countItems(current, 'floorPermit') === 0) {
      const offer = current.shop.findIndex(
        (o) => o.itemId === 'floorPermit' && !o.sold && o.price <= current.budget,
      );
      if (offer < 0) break;
      const bought = buyOffer(current, offer);
      if (!bought.ok) break;
      current = bought.state;
      log.bought++;
    }
    const used = useFloorPermit(current);
    if (!used.ok) break;
    current = used.state;
    log.used++;
    const tile = current.itemFloors!.cells.at(-1)!.tile;
    log.tiles[tile] = (log.tiles[tile] ?? 0) + 1;
  }
  return current;
}
