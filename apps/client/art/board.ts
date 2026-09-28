/**
 * 盤面の素材: 床タイル3種・使用不可マス・ハザード柄の枠（角・辺）・ページの背景
 *
 * - 床: 盤面ではマスごとに3種から決まった並びで選ぶ（毎回同じ見た目。board/views.ts）。ポンコツな工場らしく汚れ・ひび
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

/** ボルトの頭（床に打ち込まれた鋲） */
const rivet = (x: number, y: number) =>
  circle(x, y, 2.5, { fill: B.floorDetail, stroke: shade(B.floorLine), 'stroke-width': 1 });

/** ハザード柄の斜めじま（横方向に 16px 周期。左右につなげても柄が切れない） */
const stripes = (height: number) =>
  [-16, 0, 16].map((x) =>
    polygon(`${x + 8},0 ${x + 16},0 ${x + 16 - height},${height} ${x + 8 - height},${height}`, {
      fill: B.hazardBlack,
    }),
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
        el('ellipse', { cx: 42, cy: 44, rx: 11, ry: 6, fill: B.floorDetail, opacity: 0.8 }),
        el('ellipse', { cx: 34, cy: 49, rx: 4, ry: 2.5, fill: B.floorDetail, opacity: 0.8 }),
        path('M8 14 l7 5 l-2 6 l6 4', line(B.floorLine, 1.5)),
      ],
      TILE,
    ),
    'src/assets/board/floor-blocked.svg': svg(
      '使用不可マス（床の補修工事中）: 赤白の工事柵とコーン',
      [
        rect(0, 0, 64, 64, { fill: B.blocked }),
        ...[-48, -24, 0, 24, 48].map((x) =>
          polygon(`${x},64 ${x + 12},64 ${x + 76},0 ${x + 64},0`, { fill: INK.white, opacity: 0.85 }),
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
      [rect(0, 0, 16, 16, { fill: B.hazardYellow }), ...stripes(16), path('M0 15 H16', line(INK.outline, 2))],
      '0 0 16 16',
    ),
    'src/assets/board/frame-corner.svg': svg(
      '盤面の枠の角（左上。ほかの角は回転して使う）',
      [
        el(
          'clipPath',
          { id: 'corner' },
          path('M16 0 H12 A12 12 0 0 0 0 12 V16 H16 Z', {}),
        ),
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
