/**
 * 日ごとのステージ（床の配置）の生成と検証
 *
 * テンプレート（7×7 の文字列。balance/stages.ts）を帯から抽選し、回転・反転（8通り）で水増しする。
 * 盤面が 7×7 より広いときは、シードで決めた位置に埋め込む（はみ出た外周は床なし）。
 * 検証（使用不可で空きマスが分断されない・空きマスが十分ある）に通らなければ引き直し、
 * 試行回数の上限に達したら、帯の最初のテンプレートをそのまま使う（無制限に引き直さない）。
 */
import type { StageBalance } from '../balance';
import { createPrng } from '../core/prng';
import { isBlockedCell } from './layer';
import type { FloorLayer, FloorTileId } from './types';

const TILE_CODES: Record<string, FloorTileId> = {
  '2': 'double',
  '+': 'add',
  '3': 'triple',
  '#': 'blocked',
};

interface Size {
  width: number;
  height: number;
}

/** テンプレートを床の配置（テンプレートの大きさ）に変換する */
export function parseTemplate(rows: string[]): { size: Size; floor: FloorLayer } {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const floor: FloorLayer = [];
  for (const row of rows) {
    if (row.length !== width) throw new Error('テンプレートの行の長さが揃っていません');
    for (const c of row) {
      if (c === '.') {
        floor.push(null);
        continue;
      }
      const tile = TILE_CODES[c];
      if (!tile) throw new Error(`不明な床の記号: ${c}`);
      floor.push({ tile, source: 'stage' });
    }
  }
  return { size: { width, height }, floor };
}

/**
 * 回転・反転（variant 0〜7: 下位2ビットが時計回りの回転回数、4 以上は左右反転してから回転）。
 * 正方形のテンプレートを前提にする
 */
export function transformFloor(floor: FloorLayer, size: number, variant: number): FloorLayer {
  const out: FloorLayer = new Array(size * size).fill(null);
  const turns = variant & 3;
  const flip = variant >= 4;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let sx = flip ? size - 1 - x : x;
      let sy = y;
      // 時計回りに turns 回まわした位置へ
      for (let t = 0; t < turns; t++) [sx, sy] = [size - 1 - sy, sx];
      out[sy * size + sx] = floor[y * size + x] ?? null;
    }
  }
  return out;
}

/** 小さい床を、広い盤面の (ox, oy) に埋め込む */
function embed(floor: FloorLayer, from: Size, to: Size, ox: number, oy: number): FloorLayer {
  const out: FloorLayer = new Array(to.width * to.height).fill(null);
  for (let y = 0; y < from.height; y++) {
    for (let x = 0; x < from.width; x++) {
      out[(y + oy) * to.width + (x + ox)] = floor[y * from.width + x] ?? null;
    }
  }
  return out;
}

/**
 * ステージの検証: 使用不可を除いたマスが上下左右につながって1つの塊になっていて、
 * 盤面の minFreePercent% 以上あること（スイッチと出荷口はプレイヤーが置くので、つながっていれば結べる）
 */
export function validateStage(floor: FloorLayer, size: Size, minFreePercent: number): boolean {
  const total = size.width * size.height;
  const free: number[] = [];
  for (let i = 0; i < total; i++) if (!isBlockedCell(floor, i)) free.push(i);
  if (free.length * 100 < total * minFreePercent) return false;

  const seen = new Set<number>([free[0]!]);
  const queue = [free[0]!];
  while (queue.length > 0) {
    const i = queue.pop()!;
    const x = i % size.width;
    const y = Math.floor(i / size.width);
    const next = [
      x > 0 ? i - 1 : -1,
      x < size.width - 1 ? i + 1 : -1,
      y > 0 ? i - size.width : -1,
      y < size.height - 1 ? i + size.width : -1,
    ];
    for (const n of next) {
      if (n < 0 || seen.has(n) || isBlockedCell(floor, n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return seen.size === free.length;
}

/** テンプレート1つをそのまま（回転なし・左上に）盤面の大きさの床にする */
export function templateToFloor(rows: string[], board: Size): FloorLayer {
  const { size, floor } = parseTemplate(rows);
  return embed(floor, size, board, 0, 0);
}

export interface GenerateStageOptions {
  seed: number;
  /** 抽選するテンプレートの ID */
  band: string[];
  board: Size;
  stages: StageBalance;
  /** ×2床を×3床に置き換える枚数（延長戦で日が進むほど増やす） */
  upgrades?: number;
}

/** 帯からステージを1つ生成する（決定論。同じ入力なら同じ床） */
export function generateStage({
  seed,
  band,
  board,
  stages,
  upgrades = 0,
}: GenerateStageOptions): FloorLayer {
  const rng = createPrng(seed);
  const build = (id: string, variant: number, ox: number, oy: number): FloorLayer => {
    const rows = stages.templates[id];
    if (!rows) throw new Error(`不明なステージのテンプレート: ${id}`);
    const { size, floor } = parseTemplate(rows);
    const turned = size.width === size.height ? transformFloor(floor, size.width, variant) : floor;
    return upgrade(embed(turned, size, board, ox, oy), upgrades);
  };

  for (let attempt = 0; attempt < stages.maxAttempts && band.length > 0; attempt++) {
    const id = band[rng.nextInt(band.length)]!;
    const size = parseTemplate(stages.templates[id] ?? []).size;
    const variant = rng.nextInt(8);
    const ox = rng.nextInt(Math.max(1, board.width - size.width + 1));
    const oy = rng.nextInt(Math.max(1, board.height - size.height + 1));
    const floor = build(id, variant, ox, oy);
    if (validateStage(floor, board, stages.minFreePercent)) return floor;
  }
  // 上限に達したら、帯の最初のテンプレートをそのまま使う（テストで検証に通ることを確かめている）
  return band.length > 0
    ? build(band[0]!, 0, 0, 0)
    : new Array(board.width * board.height).fill(null);
}

/** ×2床を先頭（マス番号の小さい順）から count 枚、×3床に置き換える */
function upgrade(floor: FloorLayer, count: number): FloorLayer {
  if (count <= 0) return floor;
  let left = count;
  return floor.map((cell) => {
    if (left > 0 && cell?.tile === 'double') {
      left--;
      return { ...cell, tile: 'triple' };
    }
    return cell;
  });
}
