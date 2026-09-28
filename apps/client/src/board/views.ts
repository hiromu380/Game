/**
 * 盤面に置く表示オブジェクトの生成（パーツ・信号・床）
 *
 * ここは「見た目を作る」だけで、ゲームの計算はしない。
 * 倍率などの数値は sim パッケージの関数・ルールから受け取って表示する。
 */
import type { Dir4, Part, PartBadge, Score } from '@chain-factory/sim';
import { Container, Graphics, Sprite, Text, TilingSprite } from 'pixi.js';
import { BOARD_THEME, PART_ASSETS } from '../assets/manifest';
import { BOARD_PADDING, CELL_SIZE } from './layout';
import type { BoardTextures, PartTextures } from './textures';

/** パーツ画像の表示サイズ（マスに対する割合） */
export const PART_DISPLAY_SIZE = Math.round(CELL_SIZE * 0.78);

// -----------------------------------------------------------------------------
// パーツ
// -----------------------------------------------------------------------------

/**
 * 矢印バッジで向きを示すパーツの出力方向。
 * 画像自体が向きを表すパーツ（コンベア・分岐器）や、向きに意味がないパーツは空
 */
function arrowDirs(part: Part): Dir4[] {
  if (PART_ASSETS[part.id].rotates) return [];
  switch (part.id) {
    case 'barrel':
    case 'junkbot':
    case 'dock':
    case 'reflector':
    case 'oiler':
      return [];
    default:
      return [part.dir];
  }
}

/** 向きを示す矢印（マスの縁に置く） */
function createArrow(dir: Dir4): Graphics {
  const arrow = new Graphics()
    .poly([0, -9, 9, 5, -9, 5])
    .fill(BOARD_THEME.arrowFill)
    .stroke({ width: 2.5, color: BOARD_THEME.arrowStroke, join: 'round' });
  const angle = (dir * Math.PI) / 2;
  const offset = CELL_SIZE * 0.4;
  arrow.position.set(Math.sin(angle) * offset, -Math.cos(angle) * offset);
  arrow.rotation = angle;
  return arrow;
}

/** 倍率などを示す小さなバッジ（例: ×2） */
function createBadge(text: string): Container {
  const badge = new Container();
  const label = new Text({
    text,
    style: { fill: BOARD_THEME.badgeText, fontSize: 15, fontWeight: '900' },
  });
  label.anchor.set(0.5);
  const w = Math.max(24, label.width + 10);
  badge.addChild(
    new Graphics()
      .roundRect(-w / 2, -11, w, 22, 11)
      .fill(BOARD_THEME.badgeFill)
      .stroke({ width: 2, color: BOARD_THEME.badgeText }),
    label,
  );
  return badge;
}

/**
 * パーツの表示（中心が原点）
 * @param badge 効果量バッジ（×2 や +3。置き場所で決まる効果を持つパーツのみ）
 */
export function createPartView(
  part: Part,
  textures: PartTextures,
  badge: PartBadge | null,
): Container {
  const view = new Container();

  const sprite = new Sprite(textures[part.id]);
  sprite.anchor.set(0.5);
  sprite.width = PART_DISPLAY_SIZE;
  sprite.height = PART_DISPLAY_SIZE;
  if (PART_ASSETS[part.id].rotates) sprite.rotation = (part.dir * Math.PI) / 2;
  view.addChild(sprite);

  for (const dir of arrowDirs(part)) view.addChild(createArrow(dir));

  if (badge) {
    const label = createBadge(`${badge.kind === 'mul' ? '×' : '+'}${badge.value}`);
    // ギアは歯車の中央、それ以外は左下（向きの矢印と重ならない位置）に置く
    if (part.id !== 'gear') label.position.set(-CELL_SIZE * 0.24, CELL_SIZE * 0.3);
    view.addChild(label);
  }
  return view;
}

// -----------------------------------------------------------------------------
// 信号
// -----------------------------------------------------------------------------

/** 値の桁数に応じた段階（0〜）。大きな値ほど大きく派手に見せる */
export function valueTier(value: Score): number {
  return Math.min(value.toString().length - 1, BOARD_THEME.signalTiers.length - 1);
}

/** 信号（値つきの光る玉） */
export function createSignalView(value: Score, formatCompact: (value: Score) => string): Container {
  const tier = valueTier(value);
  const color = BOARD_THEME.signalTiers[tier]!;
  const radius = 13 + tier * 2.5;

  const view = new Container();
  view.addChild(
    new Graphics().circle(0, 0, radius + 7).fill({ color, alpha: 0.3 }), // 外側の光
    new Graphics()
      .circle(0, 0, radius)
      .fill(color)
      .stroke({ width: 2, color: 0xffffff, alpha: 0.8 }),
  );
  const label = new Text({
    text: formatCompact(value),
    style: { fill: BOARD_THEME.signalText, fontSize: 12 + tier, fontWeight: '900' },
  });
  label.anchor.set(0.5);
  view.addChild(label);
  return view;
}

// -----------------------------------------------------------------------------
// 床
// -----------------------------------------------------------------------------

/** 床タイルの選び方（マスの位置から決まる。無地がほとんどで、鋲は時々・汚れはまれ） */
function floorVariant(x: number, y: number): number {
  // 整数ハッシュ（行や列でそろわないよう、x と y を混ぜてからかき混ぜる）
  let h = Math.imul(x * 31 + y * 17 + 7, 0x9e3779b1);
  h ^= h >>> 13;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 16;
  const n = (h >>> 0) % 16;
  return n < 12 ? 0 : n < 15 ? 1 : 2;
}

/**
 * 床（タイル）とハザード柄の枠。素材は assets/board/（art/board.ts）
 * 枠は角4つ＋辺4本（辺は柄を並べてつなぐ）なので、どの盤面サイズでも同じ見た目になる
 */
export function createFloor(width: number, height: number, textures: BoardTextures): Container {
  const floor = new Container();
  const innerW = width * CELL_SIZE;
  const innerH = height * CELL_SIZE;
  const outerW = innerW + BOARD_PADDING * 2;
  const outerH = innerH + BOARD_PADDING * 2;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tile = new Sprite(textures.floors[floorVariant(x, y)]);
      tile.position.set(BOARD_PADDING + x * CELL_SIZE, BOARD_PADDING + y * CELL_SIZE);
      tile.setSize(CELL_SIZE, CELL_SIZE);
      // 市松模様: 1マスおきに少しだけ暗くする
      if ((x + y) % 2 === 1) tile.tint = 0xeeeeee;
      floor.addChild(tile);
    }
  }

  // 辺: 上・右・下・左の順に、素材（上辺の向き）を 90 度ずつ回して置く
  const half = BOARD_PADDING / 2;
  const edges = [
    { x: outerW / 2, y: half, length: innerW, angle: 0 },
    { x: outerW - half, y: outerH / 2, length: innerH, angle: 90 },
    { x: outerW / 2, y: outerH - half, length: innerW, angle: 180 },
    { x: half, y: outerH / 2, length: innerH, angle: 270 },
  ];
  for (const e of edges) {
    const edge = new TilingSprite({
      texture: textures.frameEdge,
      width: e.length,
      height: BOARD_PADDING,
    });
    edge.anchor.set(0.5);
    edge.position.set(e.x, e.y);
    edge.angle = e.angle;
    floor.addChild(edge);
  }
  // 角: 左上・右上・右下・左下
  const corners = [
    { x: half, y: half, angle: 0 },
    { x: outerW - half, y: half, angle: 90 },
    { x: outerW - half, y: outerH - half, angle: 180 },
    { x: half, y: outerH - half, angle: 270 },
  ];
  for (const c of corners) {
    const corner = new Sprite(textures.frameCorner);
    corner.anchor.set(0.5);
    corner.position.set(c.x, c.y);
    corner.angle = c.angle;
    floor.addChild(corner);
  }
  return floor;
}

/**
 * 使用不可マス（補修工事中）の表示
 * @param upcoming true なら「夜シフトで使えなくなる」予告（点線の枠だけ）
 */
export function createBlockedCell(
  x: number,
  y: number,
  upcoming: boolean,
  textures: BoardTextures,
): Container {
  const left = BOARD_PADDING + x * CELL_SIZE;
  const top = BOARD_PADDING + y * CELL_SIZE;
  if (!upcoming) {
    // 工事中: 工事柵とコーンの素材（assets/board/floor-blocked.svg）
    const sprite = new Sprite(textures.blocked);
    sprite.position.set(left + 2, top + 2);
    sprite.setSize(CELL_SIZE - 4, CELL_SIZE - 4);
    sprite.alpha = 0.92;
    return sprite;
  }
  // 夜シフトの予告: 黄色の点線の枠（点線の代わりに短い線分を並べる）
  const g = new Graphics();
  const inset = 5;
  const size = CELL_SIZE - inset * 2;
  for (let i = 0; i < size; i += 10) {
    const len = Math.min(5, size - i);
    g.moveTo(left + inset + i, top + inset).lineTo(left + inset + i + len, top + inset);
    g.moveTo(left + inset + i, top + inset + size).lineTo(
      left + inset + i + len,
      top + inset + size,
    );
    g.moveTo(left + inset, top + inset + i).lineTo(left + inset, top + inset + i + len);
    g.moveTo(left + inset + size, top + inset + i).lineTo(
      left + inset + size,
      top + inset + i + len,
    );
  }
  return g.stroke({ width: 3, color: BOARD_THEME.hazardYellow });
}
