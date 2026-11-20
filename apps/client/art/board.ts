/**
 * 盤面の素材: 床タイル3種・使用不可マス・ハザード柄の枠（角・辺）・ページの背景
 *
 * - 床: 盤面ではマスごとに3種から決まった並びで選ぶ（毎回同じ見た目。board/views.ts）。ポンコツな工場らしく汚れ・ひび
 * - 床タイル（×2・加算・×3）: 地の床に、角を落とした縞鋼板を「はめ込んだ」平たい表現にする（左上に影・右下に光で、
 *   へこんで見える。パーツ＝床の上に載った立体と区別するため、鋲や浮き上がる影は付けない）。
 *   種類は色だけでなく溝の模様でも見分けられるようにする
 *   （×2 = 斜めの溝2本、加算 = 十字の溝、×3 = 斜めの溝3本）。数字（×2・+3）は盤面側で重ねる（効果量が変わっても追従する）
 * - 枠: 角（16×16）と、横に並べてつなげられる辺（16×16）に分け、どの盤面サイズでも並べられるようにする
 */
import {
  BOARD_COLORS as B,
  darken,
  INK,
  MATERIAL_COLORS as M,
  UI_COLORS,
} from '../src/assets/palette';
import { circle, el, group, line, path, polygon, rect, shade, svg } from './svg';

const TILE = '0 0 64 64';

/** 床の地（目地の線・左上のハイライト・右下の影） */
const floorBase = () => [
  rect(0, 0, 64, 64, { fill: B.floorA }),
  path('M1 63 H63 V1', line(shade(B.floorA), 3)),
  path('M1 62 V1 H62', line(B.floorB, 1.5)),
  rect(0, 0, 64, 64, { fill: 'none', stroke: B.floorLine, 'stroke-width': 2 }),
];

/** ボルトの頭（床に打ち込まれた鋲。床タイル・置ける場所の表示と競合しないよう薄く） */
const rivet = (x: number, y: number) =>
  circle(x, y, 2.5, {
    fill: B.floorDetail,
    stroke: shade(B.floorLine),
    'stroke-width': 1,
    opacity: 0.45,
  });

/** ハザード柄の斜めじま（横方向に 16px 周期。左右につなげても柄が切れない） */
const stripes = (height: number) =>
  [-16, 0, 16].map((x) =>
    polygon(`${x + 8},0 ${x + 16},0 ${x + 16 - height},${height} ${x + 8 - height},${height}`, {
      fill: B.hazardBlack,
    }),
  );

/** 色を明るくする（縞鋼板の突起・光の線） */
const lighten = (color: string, amount: number) => {
  const n = parseInt(color.slice(1), 16);
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

/** 面取りした八角の外形（x0..x1 の正方形の角を c だけ落とす） */
const chamfered = (x0: number, x1: number, c: number) =>
  `${x0 + c},${x0} ${x1 - c},${x0} ${x1},${x0 + c} ${x1},${x1 - c} ${x1 - c},${x1} ${x0 + c},${x1} ${x0},${x1 - c} ${x0},${x0 + c}`;

/**
 * 床タイルの板（地の床にはめ込んだ、平たい色の鉄板）
 * - 角を落とした鉄板が、一段低い溝（濃い色の縁）にはまっている
 * - 表面は縞鋼板（滑り止めの小さな突起が互い違いに並ぶ）。工場の床らしい質感を出す
 * - 種類の模様（溝）は鉄板に刻んだ線にする。左上に影・右下に光の線で、へこんで見せる（浮き上がる影は付けない）
 */
const floorPlate = (color: string, grooves: string[]) => [
  ...floorBase(),
  polygon(chamfered(3, 61, 8), { fill: darken(color, 0.55) }),
  polygon(chamfered(6, 58, 7), { fill: darken(color, 0.32) }),
  ...diamondStuds(color),
  ...grooves,
  path('M6.5 51 V13 L13 6.5 H51', line(darken(color, 0.5), 2.5)),
  path('M57.5 13 V51 L51 57.5 H13', { ...line(lighten(color, 0.55), 1.5), opacity: 0.8 }),
];

/** 縞鋼板の突起（斜めの短い粒を、互い違いの向きで格子状に並べる） */
const diamondStuds = (color: string) => {
  const studs: string[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const x = 14 + col * 9 + (row % 2) * 4.5;
      const y = 14 + row * 9;
      if (x > 52) continue;
      const angle = (row + col) % 2 === 0 ? 45 : -45;
      studs.push(
        el('ellipse', {
          cx: x,
          cy: y,
          rx: 3.2,
          ry: 1.1,
          fill: lighten(color, 0.2),
          opacity: 0.45,
          transform: `rotate(${angle} ${x} ${y})`,
        }),
      );
    }
  }
  return studs;
};

/** 刻んだ斜めの溝（左下 → 右上。c は溝の位置）。濃い線に、下側だけ細い光を添えて彫った線に見せる */
const grooveDiagonal = (color: string, c: number) =>
  group(
    {},
    path(`M${c - 13} ${c + 13} L${c + 13} ${c - 13}`, line(darken(color, 0.55), 3.5)),
    path(`M${c - 12} ${c + 15} L${c + 15} ${c - 12}`, {
      ...line(lighten(color, 0.5), 1.2),
      opacity: 0.7,
    }),
  );

/** 刻んだ十字の溝（加算床） */
const grooveCross = (color: string) =>
  group(
    {},
    path('M32 15 V49 M15 32 H49', line(darken(color, 0.55), 4)),
    path('M34 17 V49 M17 34 H49', { ...line(lighten(color, 0.5), 1.2), opacity: 0.7 }),
  );

export function boardFiles(): Record<string, string> {
  return {
    'src/assets/board/floor-1.svg': svg('床タイル: 無地', floorBase(), TILE),
    'src/assets/board/floor-2.svg': svg(
      '床タイル: 四隅に鋲',
      [...floorBase(), rivet(9, 9), rivet(55, 9), rivet(9, 55), rivet(55, 55)],
      TILE,
    ),
    'src/assets/board/floor-3.svg': svg(
      '床タイル: 油じみとひび（ポンコツな工場）',
      [
        ...floorBase(),
        el('ellipse', { cx: 42, cy: 44, rx: 11, ry: 6, fill: B.floorDetail, opacity: 0.4 }),
        el('ellipse', { cx: 34, cy: 49, rx: 4, ry: 2.5, fill: B.floorDetail, opacity: 0.4 }),
        path('M8 14 l7 5 l-2 6 l6 4', { ...line(B.floorLine, 1.5), opacity: 0.5 }),
      ],
      TILE,
    ),
    'src/assets/board/floor-double.svg': svg(
      '床タイル: ×2床（琥珀色の鉄板・斜めの溝2本）',
      floorPlate(B.floorDouble, [
        grooveDiagonal(B.floorDouble, 26),
        grooveDiagonal(B.floorDouble, 40),
      ]),
      TILE,
    ),
    'src/assets/board/floor-add.svg': svg(
      '床タイル: 加算床（緑の鉄板・十字の溝）',
      floorPlate(B.floorAdd, [grooveCross(B.floorAdd)]),
      TILE,
    ),
    'src/assets/board/floor-triple.svg': svg(
      '床タイル: ×3床（桃色の鉄板・斜めの溝3本）',
      floorPlate(B.floorTriple, [
        grooveDiagonal(B.floorTriple, 20),
        grooveDiagonal(B.floorTriple, 32),
        grooveDiagonal(B.floorTriple, 44),
      ]),
      TILE,
    ),
    'src/assets/board/floor-blocked.svg': svg(
      '使用不可マス（床の補修工事中）: 赤白の工事柵とコーン',
      [
        // 盤面で目立ちすぎないよう、赤白の柵は少し沈めた色にする（工事中であることは柄とコーンで伝わる）
        rect(0, 0, 64, 64, { fill: darken(B.blocked, 0.3) }),
        ...[-48, -24, 0, 24, 48].map((x) =>
          polygon(`${x},64 ${x + 12},64 ${x + 76},0 ${x + 64},0`, {
            fill: INK.white,
            opacity: 0.5,
          }),
        ),
        rect(2, 2, 60, 60, { fill: 'none', stroke: INK.outline, 'stroke-width': 3 }),
        polygon('32,14 42,46 22,46', {
          fill: M.fire,
          stroke: INK.outline,
          'stroke-width': 3,
          'stroke-linejoin': 'round',
        }),
        path('M26 34 H38', line(INK.white, 4)),
        rect(16, 46, 32, 6, { fill: INK.steelDark, stroke: INK.outline, 'stroke-width': 2.5 }, 2),
      ],
      TILE,
    ),
    'src/assets/board/frame-edge.svg': svg(
      '盤面の枠の辺（横に並べる。縦の辺は回転して使う）',
      [
        rect(0, 0, 16, 16, { fill: B.hazardYellow }),
        ...stripes(16),
        path('M0 15 H16', line(INK.outline, 2)),
      ],
      '0 0 16 16',
    ),
    'src/assets/board/frame-corner.svg': svg(
      '盤面の枠の角（左上。ほかの角は回転して使う）',
      [
        el('clipPath', { id: 'corner' }, path('M16 0 H12 A12 12 0 0 0 0 12 V16 H16 Z', {})),
        el(
          'g',
          { 'clip-path': 'url(#corner)' },
          rect(0, 0, 16, 16, { fill: B.hazardYellow }),
          ...stripes(16),
        ),
        path('M15 16 V15 H16', line(INK.outline, 2)),
      ],
      '0 0 16 16',
    ),
    'src/assets/board/background.svg': svg(
      'ページの背景（縞鋼板の模様。目立たない濃さで敷き詰める）',
      [
        rect(0, 0, 32, 32, { fill: UI_COLORS.bg }),
        ...[
          [8, 8, 45],
          [24, 24, 45],
          [24, 8, -45],
          [8, 24, -45],
        ].map(([x, y, deg]) =>
          el('rect', {
            x: x! - 5,
            y: y! - 1.2,
            width: 10,
            height: 2.4,
            rx: 1.2,
            fill: UI_COLORS.panel,
            opacity: 0.55,
            transform: `rotate(${deg} ${x} ${y})`,
          }),
        ),
      ],
      '0 0 32 32',
    ),
  };
}
