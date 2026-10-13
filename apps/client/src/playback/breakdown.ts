/**
 * 出荷の計算の内訳（純粋関数）
 *
 * いちばん大きい出荷について、スイッチの最初の信号から出荷口まで、どのパーツ・床で値がどう変わったかをたどる。
 * events の emit.parent（その信号を生んだ信号）と ship.signalId だけを使い、ロジックは再計算しない。
 */
import type { FloorTileId, PartId, Score, SimEvent } from '@chain-factory/sim';

export interface BreakdownStep {
  /** 値を変えたパーツ（床だけが効いたときも、その床の上のパーツ） */
  partId: PartId;
  /** そのパーツの床（効いたときだけ） */
  floor: FloorTileId | null;
  /** 入ってきた値・床の後の値・出ていった値（出荷口では出荷した値） */
  before: Score;
  afterFloor: Score;
  after: Score;
}

export interface ShipBreakdown {
  /** スイッチが撃った値 */
  start: Score;
  /** 値が変わった段（値が変わらない通過は省く） */
  steps: BreakdownStep[];
  /** 同時出荷ボーナスの倍率（1 なら無し。steps の出荷口の値はこれを掛ける前） */
  sync: number;
  /** 出荷した値 */
  shipped: Score;
}

type Emit = Extract<SimEvent, { type: 'emit' }>;
type Activate = Extract<SimEvent, { type: 'activate' }>;
type Floor = Extract<SimEvent, { type: 'floor' }>;

export function biggestShipBreakdown(events: readonly SimEvent[]): ShipBreakdown | null {
  const emits = new Map<number, Emit>();
  /** 信号 → その信号が発動させたパーツ（と、直前に効いた床） */
  const activations = new Map<number, { act: Activate; floor: Floor | null }>();
  let biggest: Extract<SimEvent, { type: 'ship' }> | null = null;
  let previous: SimEvent | null = null;
  for (const e of events) {
    if (e.type === 'emit') emits.set(e.signalId, e);
    if (e.type === 'activate') {
      // 床の効果は発動の直前に記録される（同じ tick・同じマス）
      const floor =
        previous?.type === 'floor' &&
        previous.tick === e.tick &&
        previous.x === e.x &&
        previous.y === e.y
          ? previous
          : null;
      activations.set(e.signalId, { act: e, floor });
    }
    if (e.type === 'ship' && (!biggest || e.value > biggest.value)) biggest = e;
    previous = e;
  }
  if (!biggest || biggest.signalId === null) return null;

  // 出荷口に届いた信号から、スイッチの信号までさかのぼる
  const chain: Emit[] = [];
  const seen = new Set<number>();
  let id: number | null = biggest.signalId;
  while (id !== null && !seen.has(id)) {
    seen.add(id);
    const emit = emits.get(id);
    if (!emit) return null;
    chain.unshift(emit);
    id = emit.parent;
  }
  const root = chain[0];
  if (!root) return null;

  const steps: BreakdownStep[] = [];
  // 各信号は、親の信号が発動させたパーツから出ている
  for (let i = 1; i < chain.length; i++) {
    const parent = chain[i - 1]!;
    const child = chain[i]!;
    const at = activations.get(parent.signalId);
    if (!at) continue;
    const afterFloor = at.floor ? at.floor.after : parent.value;
    if (child.value === parent.value && !at.floor) continue;
    steps.push({
      partId: at.act.partId,
      floor: at.floor ? at.floor.tile : null,
      before: parent.value,
      afterFloor,
      after: child.value,
    });
  }
  // 出荷口（床・金色・検査の効果を含めた出荷の値。同時出荷ボーナスは別に示す）
  const last = chain[chain.length - 1]!;
  const dock = activations.get(last.signalId);
  const sync = biggest.sync;
  const dockValue = ((biggest.value as bigint) / BigInt(sync)) as Score;
  if (dock) {
    const afterFloor = dock.floor ? dock.floor.after : last.value;
    if (dockValue !== last.value || dock.floor) {
      steps.push({
        partId: dock.act.partId,
        floor: dock.floor ? dock.floor.tile : null,
        before: last.value,
        afterFloor,
        after: dockValue,
      });
    }
  }
  return { start: root.value, steps, sync, shipped: biggest.value };
}

/** 値の変わり方の短い表し方（×3・+5・÷2）。割り切れない掛け算は「→」 */
export function describeChange(before: Score, after: Score): string {
  const b = before as bigint;
  const a = after as bigint;
  if (a === b) return '';
  if (b > 0n && a > b && a % b === 0n) return `×${a / b}`;
  if (a > b) return `+${a - b}`;
  if (a > 0n && b % a === 0n) return `÷${b / a}`;
  return '→';
}
