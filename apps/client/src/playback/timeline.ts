/**
 * イベント再生の共通部分（描画に依存しない純粋なロジック）
 *
 * simulate が出力した events を tick ごとにまとめる。いつどの tick を再生するか（加速・止め・上限）は
 * playback/choreography.ts が決める。演出側はロジックを再計算せず、イベントをそのまま見た目に反映する。
 */
import type { SimEvent } from '@chain-factory/sim';

/** 再生速度（0.25・0.5 は撮影モード用のスロー） */
export type PlaybackSpeed = 0.25 | 0.5 | 1 | 2 | 'skip';

/** events を tick ごとの配列にまとめる（index = tick） */
export function groupEventsByTick(events: SimEvent[]): SimEvent[][] {
  const ticks: SimEvent[][] = [];
  for (const event of events) {
    (ticks[event.tick] ??= []).push(event);
  }
  // イベントのない tick も空配列で埋める
  for (let i = 0; i < ticks.length; i++) ticks[i] ??= [];
  return ticks;
}
