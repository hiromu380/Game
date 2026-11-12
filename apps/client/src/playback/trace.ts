/**
 * 「信号が通った道すじ」の集計（描画に依存しない純粋なロジック）
 *
 * 試運転・本番の再生が終わったあと、盤面に道すじを薄く残して「どこを通って、どこで増えたか」を
 * 見直せるようにする。events を読むだけで、パーツの計算はやり直さない。
 */
import type { SimEvent } from '@chain-factory/sim';

/** マスからマスへの1区間（向きつき） */
export interface TraceSegment {
  fromX: number;
  fromY: number;
  /** 行き先（盤面の外へ出た信号は、盤面の外の座標になる） */
  toX: number;
  toY: number;
  /** この区間をこの向きに通った信号の数 */
  count: number;
}

/** events から、信号が通った区間をまとめる（最初に通った順） */
export function summarizeTrace(events: SimEvent[]): TraceSegment[] {
  const positions = new Map<number, { x: number; y: number }>();
  const segments = new Map<string, TraceSegment>();
  const pass = (signalId: number, x: number, y: number) => {
    const from = positions.get(signalId);
    if (!from) return;
    const key = `${from.x},${from.y},${x},${y}`;
    const segment = segments.get(key);
    if (segment) segment.count++;
    else segments.set(key, { fromX: from.x, fromY: from.y, toX: x, toY: y, count: 1 });
  };

  for (const e of events) {
    switch (e.type) {
      case 'emit':
        positions.set(e.signalId, { x: e.x, y: e.y });
        break;
      case 'move':
        pass(e.signalId, e.x, e.y);
        positions.set(e.signalId, { x: e.x, y: e.y });
        break;
      case 'vanish':
        // 盤面の外へ出た信号には move がないので、ここで最後の区間を足す
        if (e.reason === 'outOfBoard') pass(e.signalId, e.x, e.y);
        positions.delete(e.signalId);
        break;
      case 'activate':
      case 'absorb':
        positions.delete(e.signalId);
        break;
    }
  }
  return [...segments.values()];
}
