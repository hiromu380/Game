/**
 * カットシーンの背景・小物のうち、描き込みの多いもの（工場の中・屋根・月面・遠くの工場・小物）
 *
 * 絵柄は docs/art-style.md に従う: 輪郭線つき・フラットな塗り・影は1段（shade）・ハイライトは白の細線1本まで。
 * グラデーション・ぼかしは使わない（光は半透明のフラットな面で表す）。
 * 座標はシーンの座標（1280×720）か、それぞれの絵の大きさ（assets.ts の ASSETS）
 */
import {
  BOARD_COLORS as BC,
  INK,
  MATERIAL_COLORS as M,
  ROCKET_COLORS as R,
  TITLE_COLORS as T,
} from '../../src/assets/palette';
import { stars } from '../keyvisual/layers';
import { rocketBody } from '../rocket';
import { circle, el, group, line, path, polygon, rect, shade } from '../svg';

const O = INK.outline;
const fill = (color: string, width = 3) => ({
  fill: color,
  stroke: O,
  'stroke-width': width,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
});
/** 白の細いハイライト線（1本まで） */
const highlight = (d: string, width = 2) => path(d, { ...line(INK.white, width), opacity: 0.5 });
/** リベット（鋲） */
const rivet = (x: number, y: number, r = 3, color: string = INK.steelDark) =>
  circle(x, y, r, { fill: color });
/** 0..n-1 の配列 */
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const W = 1280;
const H = 720;

// =============================================================================
// 工場の中（1280×720。床は y 600 から）
// =============================================================================
const WALL = BC.background;
const WALL_PANEL = '#2a2f37';
const WALL_LOW = '#1f2329';
const BEAM = '#3a404a';
const PIPE = '#5d6b78';

/** 高い窓（夜空と星。1つには月） */
const factoryWindow = (x: number, moon: boolean) =>
  group(
    {},
    rect(x - 8, 82, 256, 186, fill(BEAM, 4), 6),
    rect(x, 90, 240, 170, { fill: '#1c2040' }),
    ...stars(240, 170, 12).map((s) => group({ transform: `translate(${x} 90)` }, s)),
    ...(moon
      ? [
          circle(x + 180, 130, 18, { fill: '#fff3c4' }),
          circle(x + 188, 124, 15, { fill: '#1c2040' }),
        ]
      : []),
    // 窓枠（十字）と、ガラスの映り込み1本
    path(`M${x + 120} 90 V260 M${x} 175 H${x + 240}`, line(BEAM, 8)),
    highlight(`M${x + 20} 110 l40 -14`, 3),
    // 窓台
    rect(x - 14, 266, 268, 12, fill(BEAM, 3), 3),
  );

/** 天井の梁（I形鋼）と、吊り下げの照明 */
const ceiling = () => [
  rect(-10, 0, W + 20, 34, fill(BEAM, 4)),
  path(`M0 26 H${W}`, line(shade(BEAM), 4)),
  ...range(16).map((i) => rivet(40 + i * 80, 14, 3.5, INK.steelDark)),
  ...[300, 660, 1020].flatMap((x) => [
    path(`M${x} 34 V64`, line(O, 3)),
    // 傘と電球、床へ落ちる淡い光（半透明のフラットな面）
    polygon(`${x - 170},600 ${x + 170},600 ${x + 12},96 ${x - 12},96`, {
      fill: '#fff3c4',
      opacity: 0.04,
    }),
    path(`M${x - 26} 92 L${x - 14} 64 H${x + 14} L${x + 26} 92 Z`, fill(INK.steelDark)),
    circle(x, 96, 7, { fill: '#fff3c4' }),
  ]),
];

/** 壁の配管（横の管・継ぎ手・バルブのハンドル・縦に降りる管） */
const pipes = () => [
  rect(0, 318, W, 22, fill(PIPE, 3)),
  path(`M0 324 H${W}`, { ...line(INK.white, 2), opacity: 0.25 }),
  ...[140, 520, 900, 1180].map((x) => rect(x - 10, 312, 20, 34, fill(INK.steelDark, 3), 3)),
  // 縦の管（床へ）
  rect(1180 - 9, 340, 18, 262, fill(PIPE, 3)),
  // バルブのハンドル
  circle(520, 300, 16, fill(BC.blocked, 3)),
  path('M504 300 H536 M520 284 V316', line(O, 3)),
  // 圧力計
  path('M900 312 V296', line(O, 3)),
  circle(900, 282, 16, fill(INK.steelLight, 3)),
  path('M900 282 L909 274', line(BC.blocked, 3)),
];

/** 壁に貼った工場の看板（歯車の印。文字は使わない）と警告の札 */
const signs = () => [
  rect(560, 380, 160, 70, fill('#2f3540', 3), 6),
  group(
    { transform: 'translate(640 415)' },
    ...range(8).map((i) =>
      rect(-5, -24, 10, 12, { ...fill(BC.hazardYellow, 2), transform: `rotate(${i * 45})` }),
    ),
    circle(0, 0, 18, fill(BC.hazardYellow, 2.5)),
    circle(0, 0, 7, { fill: '#2f3540' }),
  ),
  ...[575, 705].map((x) => rivet(x, 392, 3, INK.steel)),
  // 黄色の三角の警告札（びっくりマークの記号）
  polygon('260,470 290,420 320,470', fill(BC.hazardYellow, 3)),
  path('M290 436 V454', line(O, 4)),
  circle(290, 462, 2.6, { fill: O }),
];

/** 床（鉄板の継ぎ目・鋲・縁のハザード柄） */
const factoryFloor = () => [
  rect(0, 600, W, 120, { fill: BC.floorA }),
  ...range(9).map((i) => rect(i * 160, 612, 152, 108, { fill: i % 2 ? BC.floorA : BC.floorB })),
  ...range(9).flatMap((i) => [rivet(i * 160 + 12, 624), rivet(i * 160 + 140, 624)]),
  // 床の縁: 黄と黒の斜めの縞
  rect(0, 596, W, 16, { fill: BC.hazardBlack }),
  ...range(54).map((i) =>
    polygon(`${i * 24},612 ${i * 24 + 12},612 ${i * 24 + 24},596 ${i * 24 + 12},596`, {
      fill: BC.hazardYellow,
    }),
  ),
  path(`M0 596 H${W} M0 612 H${W}`, line(O, 3)),
];

export const workshop = () => [
  rect(0, 0, W, H, { fill: WALL }),
  // 壁の鉄板（継ぎ目と鋲）。下は一段暗い腰壁
  ...range(8).map((i) => rect(i * 160 + 4, 40, 152, 430, { fill: WALL_PANEL })),
  ...range(8).flatMap((i) => [rivet(i * 160 + 16, 52), rivet(i * 160 + 144, 52)]),
  rect(0, 470, W, 130, { fill: WALL_LOW }),
  path(`M0 470 H${W}`, line(shade(WALL_PANEL), 4)),
  ...range(16).map((i) => path(`M${i * 80 + 40} 480 V590`, line(shade(WALL_LOW), 3))),
  ...[160, 520, 880].map((x, i) => factoryWindow(x, i === 2)),
  ...pipes(),
  ...signs(),
  ...ceiling(),
  ...factoryFloor(),
];

// =============================================================================
// 屋根（1280×200。上の縁に腰かける。幕間・エンディングでは地面にも使う）
// =============================================================================
export const roof = () => [
  rect(0, 0, W, 200, { fill: T.factory }),
  // 波板の屋根（縦の筋を2色で交互に）
  ...range(40).map((i) => rect(i * 32, 22, 16, 178, { fill: '#15181f' })),
  // 天窓（暗いガラスと枠、映り込み1本）
  ...[100, 420, 740, 1060].flatMap((x) => [
    rect(x, 60, 120, 54, fill('#1d2433', 3), 4),
    path(`M${x + 60} 60 V114`, line(O, 3)),
    highlight(`M${x + 12} 70 l22 -4`),
  ]),
  // 換気扇（丸い羽根）
  ...[300, 920].flatMap((x) => [
    circle(x, 150, 26, fill(INK.steelDark, 3)),
    path(`M${x - 18} 150 H${x + 18} M${x} 132 V168`, line(O, 3)),
    circle(x, 150, 5, { fill: O }),
  ]),
  // 縁（パラペット）: 明るい天端と鋲。腰かける・歩くのはこの上
  rect(0, 0, W, 22, fill(T['factory-edge'], 3)),
  path(`M0 4 H${W}`, { ...line(INK.white, 2), opacity: 0.18 }),
  ...range(32).map((i) => rivet(i * 40 + 20, 14, 2.5, '#3a4152')),
];

// =============================================================================
// 月面（1280×720。地面は y 520 から。遠くに地球）
// =============================================================================
/** クレーター（縁は明るく、中は一段暗い） */
const crater = (x: number, y: number, r: number) => [
  el('ellipse', { cx: x, cy: y, rx: r, ry: r * 0.38, ...fill('#e3e6ec', 3) }),
  el('ellipse', {
    cx: x + r * 0.06,
    cy: y + r * 0.04,
    rx: r * 0.78,
    ry: r * 0.26,
    fill: '#aeb3bf',
  }),
  path(`M${x - r * 0.7} ${y - r * 0.08} Q${x} ${y - r * 0.3} ${x + r * 0.7} ${y - r * 0.08}`, {
    ...line('#9aa0ad', 2.5),
  }),
];

/** 岩（多角形と、右下の影） */
const rock = (x: number, y: number, s: number) => [
  polygon(
    `${x - 14 * s},${y} ${x - 10 * s},${y - 12 * s} ${x + 2 * s},${y - 18 * s} ${x + 14 * s},${y - 8 * s} ${x + 16 * s},${y}`,
    fill('#c3c8d2', 2.5),
  ),
  polygon(
    `${x + 2 * s},${y - 18 * s} ${x + 14 * s},${y - 8 * s} ${x + 16 * s},${y} ${x + 4 * s},${y}`,
    { fill: '#a7adb9' },
  ),
];

/** 地球（海・大陸・雲、右下に1段の影、ハイライト1本） */
const earth = (cx: number, cy: number, r: number) => [
  circle(cx, cy, r, fill('#3d6fb6', 4)),
  path(
    `M${cx - r * 0.7} ${cy - r * 0.3} q${r * 0.3} -${r * 0.4} ${r * 0.6} -${r * 0.1} q${r * 0.2} ${r * 0.3} -${r * 0.1} ${r * 0.5} q-${r * 0.3} ${r * 0.1} -${r * 0.5} -${r * 0.4} Z`,
    { fill: '#4caf50' },
  ),
  path(
    `M${cx + r * 0.1} ${cy + r * 0.2} q${r * 0.4} -${r * 0.2} ${r * 0.6} ${r * 0.1} q-${r * 0.1} ${r * 0.4} -${r * 0.4} ${r * 0.4} q-${r * 0.3} -${r * 0.1} -${r * 0.2} -${r * 0.5} Z`,
    { fill: '#4caf50' },
  ),
  path(
    `M${cx + r * 0.3} ${cy - r * 0.6} q${r * 0.2} ${r * 0.05} ${r * 0.4} ${r * 0.3}`,
    line(INK.white, 4),
  ),
  // 影（右下の三日月形）
  path(
    `M${cx + r * 0.2} ${cy + r * 0.98} A${r} ${r} 0 0 0 ${cx + r * 0.98} ${cy - r * 0.2} A${r * 1.1} ${r * 1.1} 0 0 1 ${cx + r * 0.2} ${cy + r * 0.98} Z`,
    { fill: '#000', opacity: 0.25 },
  ),
  highlight(
    `M${cx - r * 0.75} ${cy - r * 0.35} A${r * 0.85} ${r * 0.85} 0 0 1 ${cx - r * 0.3} ${cy - r * 0.78}`,
    3,
  ),
];

export const moon = () => [
  rect(0, 0, W, H, { fill: '#0b1026' }),
  ...stars(W, 500, 140),
  ...earth(170, 130, 54),
  // 遠くの稜線（一段暗い灰）
  path(
    'M0 520 L120 492 L260 506 L420 470 L560 500 L700 486 L860 462 L1000 490 L1140 476 L1280 496 V560 H0 Z',
    {
      fill: '#8f95a3',
    },
  ),
  // 手前の地面
  path('M0 540 Q300 480 640 520 T1280 500 V720 H0 Z', fill('#cfd3dc', 4)),
  ...crater(260, 625, 46),
  ...crater(905, 655, 60),
  ...crater(1150, 590, 26),
  ...crater(560, 690, 30),
  ...rock(120, 610, 1.3),
  ...rock(760, 600, 0.9),
  ...rock(1040, 700, 1.6),
  ...range(14).map((i) =>
    circle(60 + ((i * 173) % 1180), 560 + ((i * 59) % 150), 2 + (i % 3), { fill: '#b0b5c1' }),
  ),
];

// =============================================================================
// 地平線の向こうの、見知らぬ工場（200×124。窓が lit 個灯る）
// =============================================================================
export const farFactory = (lit: number) => {
  const body = '#1a1d2e';
  return [
    // 煙突と、細い煙（フラットな丸を重ねる）
    rect(150, 20, 16, 60, fill(body, 3)),
    ...[
      [158, 14, 7],
      [166, 4, 9],
      [178, -6, 8],
    ].map(([x, y, r]) => circle(x!, y! + 6, r!, { fill: '#3a3f55', opacity: 0.8 })),
    // のこぎり屋根の建物
    path('M0 120 V70 L30 46 V70 L60 46 V70 L90 46 V70 L120 46 V60 H200 V120 Z', fill(body, 3)),
    path('M30 46 V70 M60 46 V70 M90 46 V70', line('#2a2f45', 2)),
    // 屋根の天窓（のこぎりの面）
    ...[0, 30, 60, 90].map((x) =>
      polygon(`${x + 6},66 ${x + 26},51 ${x + 26},66`, { fill: '#232740' }),
    ),
    // 窓（灯ると黄色。枠つき）
    ...range(5).map((i) =>
      group(
        {},
        rect(12 + i * 36, 82, 22, 16, fill(i < lit ? M.sun : '#2a3150', 2), 2),
        path(`M${23 + i * 36} 82 V98`, line(i < lit ? '#c99400' : '#1f2540', 1.5)),
      ),
    ),
    // 扉
    rect(84, 104, 24, 16, fill('#232740', 2), 2),
  ];
};

/** 見知らぬロボのアンテナ（格子の柱・皿・ランプ。点くと水色の光の輪） */
export const strangerLamp = (on: boolean) => {
  const color = '#4dd0e1';
  return [
    ...(on
      ? [
          circle(30, 22, 26, { fill: color, opacity: 0.18 }),
          circle(30, 22, 17, { fill: color, opacity: 0.3 }),
        ]
      : []),
    // 格子の柱
    path('M22 84 L28 30 M38 84 L32 30', line('#2a3150', 4)),
    path('M23 76 L37 64 L24 52 L35 40', line('#2a3150', 2.5)),
    // 皿（遠くと交信する）
    path('M14 50 Q22 62 34 54 Z', fill('#3a4160', 2)),
    path('M22 54 L30 46', line('#2a3150', 2)),
    // ランプ
    rect(25, 26, 10, 6, fill('#2a3150', 2), 2),
    circle(30, 20, 8, fill(on ? '#b2ebf2' : '#2a3150', 2.5)),
    ...(on ? [highlight('M26 17 l3 -2')] : []),
  ];
};

// =============================================================================
// 小物
// =============================================================================
/** ノルマの箱（段ボール: ふたのフラップ・テープ・荷札・右の側面に影） */
export const quotaBox = () => [
  // 右の側面（影）
  polygon('84,14 96,6 96,78 84,86', fill(M.cardboardDark, 3)),
  // 正面
  rect(4, 14, 80, 72, fill(M.cardboard, 3), 3),
  // ふた（上面）
  polygon('4,14 16,6 96,6 84,14', fill('#d9b57c', 3)),
  path('M50 6 L44 14', line(M.cardboardDark, 2)),
  // テープ（ふたから正面へ）
  rect(36, 14, 16, 26, { fill: '#e8d3a8', stroke: O, 'stroke-width': 2 }),
  polygon('44,14 52,14 58,6 50,6', { fill: '#e8d3a8', stroke: O, 'stroke-width': 2 }),
  // 荷札（線と「上向き」の矢印の記号）
  rect(14, 50, 34, 24, fill(M.paper, 2), 2),
  path('M19 58 H34 M19 65 H30', line(INK.steelDark, 2)),
  path('M68 70 V54 M62 60 L68 54 L74 60', line(O, 3)),
  // 角のへこみ（ポンコツらしさ）
  path('M4 74 q6 2 8 10', line(M.cardboardDark, 2)),
];

/** ロケットの破片（崩れる場面）: 折れた胴体の板・欠けた翼・ナット */
export const scrap = () => [
  // 折れた胴体の板（ぎざぎざの割れ目・赤い帯・鋲）
  path('M4 14 L58 10 L62 18 L56 22 L64 30 L60 40 L6 42 Z', fill(R.body, 3)),
  path('M5 24 L60 22 L62 30 L6 32 Z', { fill: R.accent }),
  ...[14, 30, 46].map((x) => rivet(x, 16, 2.2)),
  highlight('M10 14 l30 -2'),
  // 欠けた翼
  path('M74 42 L96 6 L108 12 L100 30 L88 26 Z', fill(R.accent, 3)),
  path('M96 10 L102 14', line(shade(R.accent), 2)),
  // ナット（六角）
  polygon('116,20 126,14 136,20 136,32 126,38 116,32', fill(INK.steel, 3)),
  circle(126, 26, 5, { fill: O }),
];

/** 地面に落ちた設計図（片方が丸まった青い紙: 方眼とロケットの線） */
export const blueprintGround = () => [
  // 紙（奥が少しすぼまる）
  path('M8 40 L22 8 H104 L112 40 Z', fill(R.window, 2.5)),
  ...[38, 56, 74, 92].map((x) => path(`M${x - 4} 10 L${x - 10} 38`, { ...line('#7fb8d6', 1.2) })),
  path('M18 24 H108', line('#7fb8d6', 1.2)),
  // ロケットの線画
  path('M60 13 Q67 20 66 32 H54 Q53 20 60 13 Z', line(INK.steelDark, 2)),
  path('M54 28 L49 34 M66 28 L71 34', line(INK.steelDark, 1.6)),
  // 右端の丸まり
  el('ellipse', { cx: 108, cy: 24, rx: 7, ry: 17, ...fill('#8fcbe8', 2.5) }),
  el('ellipse', { cx: 108, cy: 24, rx: 3, ry: 9, fill: '#5e9ec0' }),
];

/** 考えの吹き出しの雲（丸を重ねた輪郭: 線を太く描いた丸の上に白い丸を重ね、内側の線を消す） */
export function thoughtCloud(circles: number[][], core: number[]): string[] {
  return [
    ...circles.map(([x, y, r]) =>
      circle(x!, y!, r!, { fill: INK.white, stroke: O, 'stroke-width': 6 }),
    ),
    ...circles.map(([x, y, r]) => circle(x!, y!, r! - 3, { fill: INK.white })),
    circle(core[0]!, core[1]!, core[2]!, { fill: INK.white }),
  ];
}

/** 絵の吹き出し（夢: 完成したロケットと星）。雲の形の輪郭、しっぽは左下の小さな丸 */
export const bubble = () => [
  circle(30, 205, 10, fill(INK.white, 2.5)),
  circle(58, 180, 15, fill(INK.white, 2.5)),
  ...thoughtCloud(
    [
      [80, 110, 50],
      [130, 70, 56],
      [200, 62, 58],
      [250, 110, 46],
      [200, 150, 50],
      [130, 150, 52],
    ],
    [165, 108, 64],
  ),
  // ロケット（ゲームのロケットと同じ絵: 窓は空）と、夜空の星
  group({ transform: 'translate(92 22) scale(1.3)' }, ...rocketBody(9, true)),
  polygon(
    '225,52 232,72 253,72 236,84 243,104 225,92 207,104 214,84 197,72 218,72',
    fill(M.sun, 2.5),
  ),
  path('M252 46 l6 -6 M256 58 h8 M242 38 v-8', line(M.sun, 2.5)),
];

/** 流れ星（細くなる尾と、きらめく頭）。光はフラットな半透明の面で */
export const shootingStar = () => [
  polygon('6,8 286,46 278,56', { fill: INK.white, opacity: 0.18 }),
  polygon('120,26 286,46 280,54', { fill: INK.white, opacity: 0.35 }),
  polygon('210,38 286,46 282,52', { fill: '#fff3c4', opacity: 0.8 }),
  circle(284, 50, 9, { fill: '#fff3c4', opacity: 0.5 }),
  polygon('284,38 287,47 296,50 287,53 284,62 281,53 272,50 281,47', { fill: INK.white }),
];

/** はしご（左右の支柱は影の面つき、段は丸い鉄の棒、ボルトで留める） */
export const ladder = () => [
  ...[10, 50].flatMap((x) => [
    rect(x - 6, 0, 12, 400, fill(INK.steelDark, 3), 3),
    rect(x + 1, 2, 4, 396, { fill: shade(INK.steelDark) }),
  ]),
  ...range(10).flatMap((i) => [
    rect(14, i * 40 + 16, 32, 8, fill(INK.steel, 2.5), 4),
    rivet(10, i * 40 + 20, 2.4, O),
    rivet(50, i * 40 + 20, 2.4, O),
  ]),
  highlight('M7 6 V394', 1.5),
];
