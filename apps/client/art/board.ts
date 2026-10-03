/**
 * 盤面の素材: 床タイル3種・使用不可マス・ハザード柄の枠（角・辺）・ページの背景
 *
 * - 床: 盤面ではマスごとに3種から決まった並びで選ぶ（毎回同じ見た目。board/views.ts）。ポンコツな工場らしく汚れ・ひび
 * - 床タイル（×2・加算・×3）: 地の床に、色つきの板を「はめ込んだ」平たい表現にする（左上に影・右下に光で、
 *   へこんで見える。パーツ＝床の上に載った立体と区別するため、鋲や浮き上がる影は付けない）。
 *   種類は色だけでなく溝の模様でも見分けられるようにする
 *   （×2 = 斜めの溝2本、加算 = 十字の溝、×3 = 斜めの溝3本）。数字（×2・+3）は盤面側で重ねる（効果量が変わっても追従する）
 * - 枠: 角（16×16）と、横に並べてつなげられる辺（16×16）に分け、どの盤面サイズでも並べられるようにする
 */
import { BOARD_COLORS as B, INK, MATERIAL_COLORS as M, UI_COLORS } from '../src/assets/palette';
import { circle, el, line, path, polygon, rect, shade, svg } from './svg';

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

/** 床タイルの板（地の床にはめ込んだ、平たい色の板。左上に影・右下に光の線で、へこんで見せる） */
const floorPlate = (color: string, grooves: string[]) => [
  ...floorBase(),
  rect(4, 4, 56, 56, { fill: color, opacity: 0.55 }, 3),
  path('M5 59 V5 H59', line(shade(shade(color)), 3)),
  path('M6 59 H59 V6', line(INK.white, 1.5)),
  ...grooves,
];

/** 斜めの溝（左下 → 右上。c は溝の位置。色は鉄板の影の色） */
const grooveDiagonal = (color: string, c: number) =>
  path(`M${c - 14} ${c + 14} L${c + 14} ${c - 14}`, line(shade(color), 3));

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
      floorPlate(B.floorAdd, [path('M32 14 V50 M14 32 H50', line(shade(B.floorAdd), 3))]),
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
        rect(0, 0, 64, 64, { fill: B.blocked }),
        ...[-48, -24, 0, 24, 48].map((x) =>
          polygon(`${x},64 ${x + 12},64 ${x + 76},0 ${x + 64},0`, {
            fill: INK.white,
            opacity: 0.85,
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
