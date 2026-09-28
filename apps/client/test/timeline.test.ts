import { DEFAULT_RULES, simulate, type Board } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { BASE_TICK_MS, groupEventsByTick, PlaybackTimeline } from '../src/playback/timeline';

/** スイッチ → ギア → 出荷口 の最小盤面 */
const board: Board = {
  width: 3,
  height: 1,
  cells: [
    { id: 'switch', dir: 1 },
    { id: 'gear', dir: 1 },
    { id: 'dock', dir: 1 },
  ],
};
const result = simulate({ board, seed: 1, rules: DEFAULT_RULES });

describe('再生タイムライン', () => {
  it('イベントを tick ごとにまとめる', () => {
    const ticks = groupEventsByTick(result.events);
    expect(ticks).toHaveLength(result.stats.ticks + 1);
    ticks.forEach((events, tick) => events.forEach((e) => expect(e.tick).toBe(tick)));
  });

  it('1x では BASE_TICK_MS ごとに 1 tick 進む。最初の tick は即時', () => {
    const tl = new PlaybackTimeline(result.events);
    expect(tl.advance(0, 1)).toHaveLength(1);
    expect(tl.advance(BASE_TICK_MS - 1, 1)).toHaveLength(0);
    expect(tl.advance(1, 1)).toHaveLength(1);
  });

  it('2x は倍の速さで進む', () => {
    const tl = new PlaybackTimeline(result.events);
    tl.advance(0, 2);
    expect(tl.advance(BASE_TICK_MS, 2)).toHaveLength(2);
  });

  it('スキップで残りをすべて返して終了する', () => {
    const tl = new PlaybackTimeline(result.events);
    tl.advance(0, 1);
    const rest = tl.advance(0, 'skip');
    expect(rest.flat().length + groupEventsByTick(result.events)[0]!.length).toBe(
      result.events.length,
    );
    expect(tl.isFinished).toBe(true);
  });
});
