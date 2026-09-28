/**
 * 「連鎖が途切れた理由」の集計（描画に依存しない純粋なロジック）
 *
 * events の消滅（vanish）と打ち切り（halt）から、どこで・なぜ信号が消えたかをまとめる。
 * 盤面外で消えた信号は、盤面の端のマスに寄せて表示する。
 */
import type { Board, SimEvent, VanishReason } from '@chain-factory/sim';

/** 盤面に表示する「途切れた場所」 */
export interface BreakMarker {
  x: number;
  y: number;
  reason: VanishReason;
  /** 同じマス・同じ理由で消えた信号の数 */
  count: number;
}

export interface BreakSummary {
  markers: BreakMarker[];
  /** 理由ごとの件数 */
  counts: Partial<Record<VanishReason, number>>;
  /** tick 上限で打ち切ったか（そのとき残っていた信号の数） */
  haltedSignals: number;
}

export function summarizeBreaks(events: SimEvent[], board: Board): BreakSummary {
  const markers = new Map<string, BreakMarker>();
  const counts: BreakSummary['counts'] = {};
  let haltedSignals = 0;

  for (const e of events) {
    if (e.type === 'halt') {
      haltedSignals = e.remainingSignals;
      continue;
    }
    if (e.type !== 'vanish') continue;
    counts[e.reason] = (counts[e.reason] ?? 0) + 1;

    // 盤面外は、いちばん近い端のマスに寄せる
    const x = Math.min(Math.max(e.x, 0), board.width - 1);
    const y = Math.min(Math.max(e.y, 0), board.height - 1);
    const key = `${x},${y},${e.reason}`;
    const marker = markers.get(key);
    if (marker) marker.count++;
    else markers.set(key, { x, y, reason: e.reason, count: 1 });
  }
  return { markers: [...markers.values()], counts, haltedSignals };
}

/** パーツごと（マスごと）の発動回数（デバッグ表示用） */
export function countActivations(
  events: SimEvent[],
): Map<string, { partId: string; count: number }> {
  const result = new Map<string, { partId: string; count: number }>();
  for (const e of events) {
    if (e.type !== 'activate') continue;
    const key = `${e.x},${e.y}`;
    const entry = result.get(key);
    if (entry) entry.count++;
    else result.set(key, { partId: e.partId, count: 1 });
  }
  return result;
}
