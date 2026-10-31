/**
 * 床の凡例: 盤面にある床の種類と、期間限定の枠・夜の予告だけを並べる（純粋関数）
 */
import type { FloorCell, FloorTileId } from '@chain-factory/sim';

export type FloorLegendEntry =
  | { kind: 'tile'; tile: FloorTileId }
  /** ボーナス床・今日の出来事の床（水色の点線） */
  | { kind: 'limited' }
  /** ランダム配置権の床（金色の点線） */
  | { kind: 'item' }
  /** 夜シフトの補修工事の予告（赤の斜線） */
  | { kind: 'upcoming' };

const TILE_ORDER: readonly FloorTileId[] = ['double', 'add', 'triple', 'blocked'];

export function floorLegendEntries(
  floor: readonly (FloorCell | null)[],
  upcomingBlocked: readonly number[],
): FloorLegendEntry[] {
  const cells = floor.filter((c): c is FloorCell => c !== null);
  const tiles = new Set(cells.map((c) => c.tile));
  const entries: FloorLegendEntry[] = TILE_ORDER.filter((tile) => tiles.has(tile)).map((tile) => ({
    kind: 'tile',
    tile,
  }));
  if (cells.some((c) => c.source === 'bonus' || c.source === 'event')) {
    entries.push({ kind: 'limited' });
  }
  if (cells.some((c) => c.source === 'item')) entries.push({ kind: 'item' });
  if (upcomingBlocked.length > 0) entries.push({ kind: 'upcoming' });
  return entries;
}
