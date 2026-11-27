import type { FloorCell } from '@chain-factory/sim';
import { describe, expect, it } from 'vitest';
import { floorLegendEntries } from '../src/state/floorLegend';

const cell = (tile: FloorCell['tile'], source: FloorCell['source'] = 'stage'): FloorCell => ({
  tile,
  source,
});

describe('床の凡例', () => {
  it('床がなく予告もなければ空', () => {
    expect(floorLegendEntries([null, null], [])).toEqual([]);
  });

  it('盤面にある床の種類だけを決まった順に1回ずつ並べ、期間限定・配置権・予告を後ろに足す', () => {
    const floor = [
      cell('triple'),
      cell('double', 'bonus'),
      null,
      cell('double'),
      cell('add', 'item'),
    ];
    expect(floorLegendEntries(floor, [7])).toEqual([
      { kind: 'tile', tile: 'double' },
      { kind: 'tile', tile: 'add' },
      { kind: 'tile', tile: 'triple' },
      { kind: 'limited' },
      { kind: 'item' },
      { kind: 'upcoming' },
    ]);
  });

  it('今日の出来事の床も期間限定として出す', () => {
    expect(floorLegendEntries([cell('blocked', 'event')], [])).toEqual([
      { kind: 'tile', tile: 'blocked' },
      { kind: 'limited' },
    ]);
  });
});
