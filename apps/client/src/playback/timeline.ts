/**
 * イベント再生の制御（描画に依存しない純粋なロジック）
 *
 * simulate が出力した events を tick ごとにまとめ、経過時間に応じて
 * 「今どの tick まで再生すべきか」を返す。演出側はロジックを再計算せず、
 * 渡されたイベントをそのまま見た目に反映するだけにする。
 */
import type { SimEvent } from '@chain-factory/sim';

/** 再生速度。'skip' は即座に最後まで進める */
/** 再生速度（0.25・0.5 は撮影モード用のスロー） */
export type PlaybackSpeed = 0.25 | 0.5 | 1 | 2 | 'skip';

/** 1x のときの 1 tick の長さ（ミリ秒） */
export const BASE_TICK_MS = 320;

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

export class PlaybackTimeline {
  private readonly ticks: SimEvent[][];
  /** 次に再生する tick */
  private nextTick = 0;
  /** 次の tick を再生するまでの残り時間 */
  private waitMs = 0;

  constructor(events: SimEvent[]) {
    this.ticks = groupEventsByTick(events);
  }

  get totalTicks(): number {
    return this.ticks.length;
  }

  get isFinished(): boolean {
    return this.nextTick >= this.ticks.length;
  }

  /** 1 tick の長さ（速度込み） */
  static tickMs(speed: PlaybackSpeed): number {
    return speed === 'skip' ? 0 : BASE_TICK_MS / speed;
  }

  /**
   * 時間を進め、この間に再生すべき tick のイベント群を返す。
   * 最初の tick は即座に再生する。
   */
  advance(deltaMs: number, speed: PlaybackSpeed): SimEvent[][] {
    if (speed === 'skip') return this.flush();

    const played: SimEvent[][] = [];
    this.waitMs -= deltaMs;
    while (!this.isFinished && this.waitMs <= 0) {
      played.push(this.ticks[this.nextTick++]!);
      this.waitMs += PlaybackTimeline.tickMs(speed);
    }
    return played;
  }

  /** 残りの tick をすべて返して終了状態にする（スキップ用） */
  flush(): SimEvent[][] {
    const rest = this.ticks.slice(this.nextTick);
    this.nextTick = this.ticks.length;
    return rest;
  }
}
