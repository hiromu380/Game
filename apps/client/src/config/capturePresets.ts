/**
 * 撮影モード（ui/CapturePanel.tsx）で呼び出す、規模別の盤面（7×7）
 *
 * 連鎖演出の確認・録画用。小・中は手で組んだもの、大はボットが組んだ盤面、特大は長い連鎖になるよう探した盤面
 * （連鎖の数・出荷の桁は docs/ops/effects-capture.md）。遊びのバランスとは関係ない。
 * 「床」はギアの列の下に×2床・加算床・×3床を敷いた盤面（床の演出の確認用。読み込むとその日の床を差し替える）
 */
import type { Board, FloorCell, FloorLayer, FloorTileId } from '@chain-factory/sim';

export type CapturePresetKey = 'small' | 'medium' | 'large' | 'huge' | 'floor';

export interface CapturePreset {
  board: Board;
  /** 床（省略時は今のランの床のまま） */
  floor?: FloorLayer;
}

const BOARDS: Record<Exclude<CapturePresetKey, 'floor'>, Board> = {
  small: {
    width: 7,
    height: 7,
    cells: [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      {
        id: 'switch',
        dir: 1,
      },
      {
        id: 'gear',
        dir: 1,
      },
      {
        id: 'dock',
        dir: 1,
      },
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ],
  },
  medium: {
    width: 7,
    height: 7,
    cells: [
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      {
        id: 'solar',
        dir: 0,
      },
      null,
      null,
      {
        id: 'switch',
        dir: 1,
      },
      {
        id: 'gear',
        dir: 1,
      },
      {
        id: 'gear',
        dir: 1,
      },
      {
        id: 'gear',
        dir: 1,
      },
      {
        id: 'press',
        dir: 1,
      },
      {
        id: 'gear',
        dir: 1,
      },
      {
        id: 'dock',
        dir: 1,
      },
      null,
      null,
      null,
      null,
      {
        id: 'solar',
        dir: 0,
      },
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ],
  },
  large: {
    width: 7,
    height: 7,
    cells: [
      {
        id: 'piggyBank',
        dir: 0,
      },
      {
        id: 'press',
        dir: 1,
      },
      {
        id: 'press',
        dir: 2,
      },
      {
        id: 'piggyBank',
        dir: 0,
      },
      {
        id: 'spreader',
        dir: 0,
      },
      {
        id: 'dock',
        dir: 0,
      },
      {
        id: 'spreader',
        dir: 2,
      },
      {
        id: 'solar',
        dir: 0,
      },
      {
        id: 'press',
        dir: 0,
      },
      {
        id: 'press',
        dir: 2,
      },
      {
        id: 'spreader',
        dir: 1,
      },
      {
        id: 'gear',
        dir: 2,
      },
      {
        id: 'barrel',
        dir: 0,
      },
      {
        id: 'dock',
        dir: 0,
      },
      {
        id: 'turntable',
        dir: 0,
      },
      {
        id: 'press',
        dir: 0,
      },
      {
        id: 'press',
        dir: 1,
      },
      {
        id: 'inspector',
        dir: 0,
      },
      {
        id: 'piggyBank',
        dir: 1,
      },
      {
        id: 'gear',
        dir: 0,
      },
      {
        id: 'conveyor',
        dir: 0,
      },
      {
        id: 'switch',
        dir: 1,
      },
      {
        id: 'solar',
        dir: 0,
      },
      null,
      {
        id: 'dock',
        dir: 0,
      },
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ],
  },
  huge: {
    width: 7,
    height: 7,
    cells: [
      {
        id: 'piggyBank',
        dir: 1,
      },
      {
        id: 'turntable',
        dir: 3,
      },
      {
        id: 'rebooter',
        dir: 3,
      },
      {
        id: 'oiler',
        dir: 3,
      },
      {
        id: 'barrel',
        dir: 0,
      },
      {
        id: 'turntable',
        dir: 0,
      },
      {
        id: 'piggyBank',
        dir: 3,
      },
      {
        id: 'rebooter',
        dir: 0,
      },
      {
        id: 'barrel',
        dir: 2,
      },
      {
        id: 'conveyor',
        dir: 2,
      },
      {
        id: 'rebooter',
        dir: 2,
      },
      {
        id: 'turntable',
        dir: 2,
      },
      {
        id: 'turntable',
        dir: 3,
      },
      {
        id: 'turntable',
        dir: 0,
      },
      {
        id: 'oiler',
        dir: 0,
      },
      {
        id: 'rebooter',
        dir: 0,
      },
      {
        id: 'turntable',
        dir: 0,
      },
      {
        id: 'barrel',
        dir: 2,
      },
      {
        id: 'oiler',
        dir: 1,
      },
      {
        id: 'barrel',
        dir: 3,
      },
      {
        id: 'piggyBank',
        dir: 0,
      },
      {
        id: 'switch',
        dir: 1,
      },
      {
        id: 'press',
        dir: 2,
      },
      {
        id: 'turntable',
        dir: 3,
      },
      {
        id: 'dock',
        dir: 0,
      },
      {
        id: 'rebooter',
        dir: 1,
      },
      {
        id: 'conveyor',
        dir: 2,
      },
      {
        id: 'rebooter',
        dir: 3,
      },
      {
        id: 'rebooter',
        dir: 2,
      },
      {
        id: 'barrel',
        dir: 2,
      },
      {
        id: 'oiler',
        dir: 1,
      },
      {
        id: 'turntable',
        dir: 1,
      },
      {
        id: 'barrel',
        dir: 1,
      },
      {
        id: 'turntable',
        dir: 2,
      },
      {
        id: 'rebooter',
        dir: 2,
      },
      {
        id: 'turntable',
        dir: 2,
      },
      {
        id: 'turntable',
        dir: 1,
      },
      {
        id: 'barrel',
        dir: 0,
      },
      {
        id: 'dock',
        dir: 2,
      },
      {
        id: 'oiler',
        dir: 0,
      },
      {
        id: 'dock',
        dir: 3,
      },
      {
        id: 'turntable',
        dir: 2,
      },
      {
        id: 'turntable',
        dir: 1,
      },
      {
        id: 'turntable',
        dir: 2,
      },
      {
        id: 'rebooter',
        dir: 3,
      },
      {
        id: 'oiler',
        dir: 0,
      },
      {
        id: 'rebooter',
        dir: 1,
      },
      {
        id: 'barrel',
        dir: 0,
      },
      {
        id: 'turntable',
        dir: 3,
      },
    ],
  },
};

/** 床の演出の確認用: スイッチ → ギア5つ → 出荷口。ギアの下に ×2・+3・×3・×2・×3 の床（出荷量 2,016） */
function floorPreset(): CapturePreset {
  const size = 7;
  const row = 3;
  const cells: Board['cells'] = new Array(size * size).fill(null);
  const floor: FloorLayer = new Array(size * size).fill(null);
  const ids = ['switch', 'gear', 'gear', 'gear', 'gear', 'gear', 'dock'] as const;
  ids.forEach((id, x) => (cells[row * size + x] = { id, dir: 1 }));
  const tiles: FloorTileId[] = ['double', 'add', 'triple', 'double', 'triple'];
  tiles.forEach((tile, i) => {
    const cell: FloorCell = { tile, source: 'stage' };
    floor[row * size + i + 1] = cell;
  });
  return { board: { width: size, height: size, cells }, floor };
}

export const CAPTURE_PRESETS: Record<CapturePresetKey, CapturePreset> = {
  small: { board: BOARDS.small },
  medium: { board: BOARDS.medium },
  large: { board: BOARDS.large },
  huge: { board: BOARDS.huge },
  floor: floorPreset(),
};
