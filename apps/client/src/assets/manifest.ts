/**
 * アセットマニフェスト（キー → 見た目の定義）
 *
 * 画面側は必ずここを経由して見た目を決める。本番イラストに差し替えるときは
 * kind: 'image' の定義（src にファイルパス）へ書き換えるだけでよい。
 * 現在は仮素材として「色分けした図形 + 頭文字」を使っている。
 */
import type { PartId } from '@chain-factory/sim';

export type ShapeKind = 'square' | 'circle' | 'diamond' | 'hexagon';

export type AssetDef =
  | {
      kind: 'shape';
      shape: ShapeKind;
      /** 塗り色（0xRRGGBB） */
      color: number;
      /** 図形の中に描く頭文字 */
      glyph: string;
    }
  | {
      kind: 'image';
      /** 画像ファイルのパス（public/ からの相対） */
      src: string;
    };

/** パーツの見た目 */
export const PART_ASSETS: Record<PartId, AssetDef> = {
  switch: { kind: 'shape', shape: 'circle', color: 0xe53935, glyph: 'S' },
  conveyor: { kind: 'shape', shape: 'square', color: 0x78909c, glyph: 'C' },
  splitter: { kind: 'shape', shape: 'diamond', color: 0x8e24aa, glyph: 'Y' },
  gear: { kind: 'shape', shape: 'hexagon', color: 0xfb8c00, glyph: 'G' },
  press: { kind: 'shape', shape: 'square', color: 0x5d4037, glyph: 'P' },
  barrel: { kind: 'shape', shape: 'circle', color: 0xd81b60, glyph: 'B' },
  junkbot: { kind: 'shape', shape: 'hexagon', color: 0x7cb342, glyph: 'J' },
  rebooter: { kind: 'shape', shape: 'diamond', color: 0x00acc1, glyph: 'R' },
  dock: { kind: 'shape', shape: 'square', color: 0x1e88e5, glyph: 'D' },
};

/** 盤面・演出の色（テーマ） */
export const BOARD_THEME = {
  background: 0x1b1f27,
  cell: 0x262c36,
  cellBorder: 0x363e4b,
  selected: 0xffeb3b,
  signal: 0xfff176,
  signalText: 0x1b1f27,
  glow: 0xffffff,
  reset: 0x4dd0e1,
  shipText: 0x69f0ae,
  glyph: 0xffffff,
  arrow: 0xffffff,
} as const;

/** 0xRRGGBB を CSS の色文字列へ */
export function toCssColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}
