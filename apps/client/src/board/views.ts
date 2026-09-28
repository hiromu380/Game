/**
 * 盤面に置く表示オブジェクトの生成（パーツ・信号・床）
 *
 * ここは「見た目を作る」だけで、ゲームの計算はしない。
 * 倍率などの数値は sim パッケージの関数・ルールから受け取って表示する。
 */
import type { Dir4, Part, PartBadge, Score } from '@chain-factory/sim';
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { BOARD_THEME, PART_ASSETS } from '../assets/manifest';
import { formatCompact } from '../ui/format';
import { BOARD_PADDING, CELL_SIZE } from './layout';
import type { PartTextures } from './textures';

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
export function createSignalView(value: Score): Container {
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

/** 工場の床（市松模様のタイル）とハザード柄の枠 */
export function createFloor(width: number, height: number): Container {
  const floor = new Container();
  const innerW = width * CELL_SIZE;
  const innerH = height * CELL_SIZE;
  const outerW = innerW + BOARD_PADDING * 2;
  const outerH = innerH + BOARD_PADDING * 2;

  // ハザード柄の枠: 黄色の下地に黒い斜線を引き、枠の形でマスクする
  const frameShape = () =>
    new Graphics()
      .roundRect(0, 0, outerW, outerH, 12)
      .fill(0xffffff)
      .rect(BOARD_PADDING, BOARD_PADDING, innerW, innerH)
      .cut();
  const stripes = new Graphics().rect(0, 0, outerW, outerH).fill(BOARD_THEME.hazardYellow);
  for (let i = -outerH; i < outerW; i += 22) {
    stripes.poly([i, 0, i + 11, 0, i + 11 + outerH, outerH, i + outerH, outerH]);
  }
  stripes.fill(BOARD_THEME.hazardBlack);
  const mask = frameShape();
  stripes.mask = mask;
  floor.addChild(stripes, mask);

  // 床タイル
  const tiles = new Graphics();
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tiles
        .rect(BOARD_PADDING + x * CELL_SIZE, BOARD_PADDING + y * CELL_SIZE, CELL_SIZE, CELL_SIZE)
        .fill((x + y) % 2 === 0 ? BOARD_THEME.floorA : BOARD_THEME.floorB);
    }
  }
  // 目地
  for (let i = 0; i <= width; i++) {
    tiles
      .moveTo(BOARD_PADDING + i * CELL_SIZE, BOARD_PADDING)
      .lineTo(BOARD_PADDING + i * CELL_SIZE, BOARD_PADDING + innerH);
  }
  for (let i = 0; i <= height; i++) {
    tiles
      .moveTo(BOARD_PADDING, BOARD_PADDING + i * CELL_SIZE)
      .lineTo(BOARD_PADDING + innerW, BOARD_PADDING + i * CELL_SIZE);
  }
  tiles.stroke({ width: 2, color: BOARD_THEME.floorLine });
  floor.addChild(tiles);
  return floor;
}

/**
 * 使用不可マス（補修工事中）の表示
 * @param upcoming true なら「今夜使えなくなる」予告（点線の枠だけ）
 */
export function createBlockedCell(x: number, y: number, upcoming: boolean): Graphics {
  const left = BOARD_PADDING + x * CELL_SIZE;
  const top = BOARD_PADDING + y * CELL_SIZE;
  const g = new Graphics();
  if (upcoming) {
    // 点線の代わりに短い線分を並べる
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
  // 工事中: 赤白の斜線と中央の ✕
  g.rect(left + 2, top + 2, CELL_SIZE - 4, CELL_SIZE - 4).fill({
    color: BOARD_THEME.blocked,
    alpha: 0.85,
  });
  for (let i = -CELL_SIZE; i < CELL_SIZE; i += 14) {
    g.moveTo(left + Math.max(0, i), top + Math.max(0, -i)).lineTo(
      left + Math.min(CELL_SIZE, CELL_SIZE + i),
      top + Math.min(CELL_SIZE, CELL_SIZE - i),
    );
  }
  g.stroke({ width: 4, color: 0xffffff, alpha: 0.35 });
  const c = CELL_SIZE / 2;
  g.moveTo(left + c - 12, top + c - 12).lineTo(left + c + 12, top + c + 12);
  g.moveTo(left + c + 12, top + c - 12).lineTo(left + c - 12, top + c + 12);
  return g.stroke({ width: 5, color: 0xffffff, cap: 'round' });
}
