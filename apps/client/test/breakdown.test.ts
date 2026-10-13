import { DEFAULT_RULES, simulate, type Board, type FloorLayer } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { biggestShipBreakdown, describeChange } from '../src/playback/breakdown';

const line = (ids: string[], floor: FloorLayer = []): ReturnType<typeof simulate> => {
  const board: Board = {
    width: ids.length,
    height: 1,
    cells: ids.map((id) => (id === '.' ? null : { id: id as never, dir: 1 })),
  };
  return simulate({ board, floor, seed: 1, rules: DEFAULT_RULES });
};

describe('出荷の計算の内訳', () => {
  it('スイッチ → ギア → ブースター → 出荷口: 値が変わった段だけを順に並べる', () => {
    const r = line(['switch', 'conveyor', 'gear', 'booster', 'dock']);
    const b = biggestShipBreakdown(r.events)!;
    expect(b.start).toBe(1n);
    expect(b.steps.map((s) => [s.partId, describeChange(s.before, s.after)])).toEqual([
      ['gear', '×2'],
      ['booster', `+${DEFAULT_RULES.params.boosterAdd}`],
    ]);
    expect(b.shipped).toBe(r.score);
  });

  it('床の効果は、その上のパーツの段に含める（出荷口の床も）', () => {
    const floor: FloorLayer = [null, null, { tile: 'double', source: 'stage' }];
    const r = line(['switch', 'gear', 'dock'], floor);
    const b = biggestShipBreakdown(r.events)!;
    expect(b.steps.map((s) => [s.partId, s.floor])).toEqual([
      ['gear', null],
      ['dock', 'double'],
    ]);
    expect(b.shipped).toBe(4n);
  });

  it('出荷がなければ null。変わり方の表し方', () => {
    expect(biggestShipBreakdown(line(['switch', 'gear']).events)).toBeNull();
    expect(describeChange(2n as never, 6n as never)).toBe('×3');
    expect(describeChange(2n as never, 7n as never)).toBe('+5');
    expect(describeChange(8n as never, 4n as never)).toBe('÷2');
    expect(describeChange(3n as never, 3n as never)).toBe('');
  });
});
