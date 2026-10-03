import { DEFAULT_RULES, simulate, type Board } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { buildChoreography, ChoreographyPlayer } from '../src/playback/choreography';
import { groupEventsByTick } from '../src/playback/timeline';

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
const choreography = buildChoreography(result.events, {
  strength: 'full',
  reduceFlashes: false,
  quota: null,
});

describe('再生タイムライン', () => {
  it('イベントを tick ごとにまとめる', () => {
    const ticks = groupEventsByTick(result.events);
    expect(ticks).toHaveLength(result.stats.ticks + 1);
    ticks.forEach((events, tick) => events.forEach((e) => expect(e.tick).toBe(tick)));
  });

  it('演出の流れの時刻どおりに tick と命令を取り出す（最初は溜めだけ）', () => {
    const player = new ChoreographyPlayer(result.events, choreography);
    const first = player.advance(0);
    expect(first.ticks).toHaveLength(0);
    expect(first.cues.map((c) => c.kind)).toEqual(['windup']);
    const next = player.advance(choreography.ticks[0]!.atMs);
    expect(next.ticks).toHaveLength(1);
  });

  it('最後まで進めると、すべての tick と命令を1回ずつ返して終わる', () => {
    const player = new ChoreographyPlayer(result.events, choreography);
    let ticks = 0;
    let cues = 0;
    for (let t = 0; t <= choreography.totalMs + 100; t += 16) {
      const due = player.advance(16);
      ticks += due.ticks.length;
      cues += due.cues.length;
    }
    expect(ticks).toBe(choreography.ticks.length);
    expect(cues).toBe(choreography.cues.length);
    expect(player.isFinished).toBe(true);
  });

  it('スキップで残りをすべて返して終了する', () => {
    const player = new ChoreographyPlayer(result.events, choreography);
    player.advance(0);
    const rest = player.flush();
    expect(rest.ticks.flatMap((t) => t.events)).toHaveLength(result.events.length);
    expect(player.isFinished).toBe(true);
  });
});
