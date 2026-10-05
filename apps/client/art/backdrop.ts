/**
 * ゲーム画面の上部の帯（ui/WorkshopBackdrop.tsx）の素材
 *
 * - sky-<0〜2>: 窓の外の景色（朝・昼・夜）。空の帯・太陽か月・雲・遠くの工場街・地面。
 *   帯の幅は画面によって変わるので、横長に描いて画面側で切り抜く（object-fit: cover・下揃え）
 * - gantry: ロケットの組み立て台（格子の柱・ハザード柄の梁・滑車とフック）。ロケットは画面側で中に置く
 * - beacon: 警告灯（ノルマが危ないときに画面側で点滅させる）
 *
 * 絵柄は docs/art-style.md に従う（フラットな塗り・1段の影・グラデーションなし）
 */
import { BOARD_COLORS as BC, INK, TITLE_COLORS as T } from '../src/assets/palette';
import { stars } from './keyvisual/layers';
import { circle, group, line, path, polygon, rect, shade, sizedSvg } from './svg';

const O = INK.outline;
const fill = (color: string, width = 2.5) => ({
  fill: color,
  stroke: O,
  'stroke-width': width,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
});
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

const SKY_W = 1600;
const SKY_H = 80;

interface SkyStyle {
  /** 空の帯（上から）。フラットな色を重ねる */
  bands: string[];
  /** 遠くの工場街の色・窓の明かり */
  town: string;
  townFar: string;
  windows: number;
  cloud: string | null;
  sun: 'morning' | 'noon' | 'moon';
}

const SKIES: SkyStyle[] = [
  // 朝: 淡い水色から、地平線は桃色
  {
    bands: ['#8fb3c4', '#9dbccb', '#b4c7cf', '#d4c4bd', '#e8c3a8'],
    town: '#56697a',
    townFar: '#7d93a2',
    windows: 0.25,
    cloud: '#eef3f5',
    sun: 'morning',
  },
  // 昼: 濃い水色
  {
    bands: ['#3f7fae', '#4b8bb8', '#5b98c2', '#6ea6cb', '#86b6d4'],
    town: '#2f4a5f',
    townFar: '#4f6f86',
    windows: 0,
    cloud: '#ffffff',
    sun: 'noon',
  },
  // 夜: 紺から紫、地平線に工場の明かり
  {
    bands: [T['sky-top'], '#1c2040', '#2a2550', T['sky-bottom'], '#4a2f55'],
    town: T.factory,
    townFar: '#2a2e45',
    windows: 0.85,
    cloud: null,
    sun: 'moon',
  },
];

/** 雲（丸を3つ重ねた平たい雲） */
const cloud = (x: number, y: number, s: number, color: string) =>
  group(
    { opacity: 0.9 },
    circle(x, y, 9 * s, { fill: color }),
    circle(x + 11 * s, y - 4 * s, 11 * s, { fill: color }),
    circle(x + 24 * s, y, 8 * s, { fill: color }),
    rect(x - 2 * s, y, 32 * s, 8 * s, { fill: color }, 4 * s),
  );

/** 遠くの工場街（のこぎり屋根・煙突・窓）。x からの1区画（幅 200） */
const block = (x: number, base: number, h: number, color: string, windows: number) => [
  path(
    `M${x} ${base} V${base - h} L${x + 20} ${base - h - 10} V${base - h} L${x + 40} ${base - h - 10} V${base - h} L${x + 60} ${base - h - 10} V${base - h} H${x + 110} V${base - h - 8} H${x + 150} V${base} Z`,
    { fill: color },
  ),
  rect(x + 120, base - h - 34, 9, 30, { fill: color }),
  rect(x + 170, base - h + 4, 30, h - 4, { fill: color }),
  ...(windows > 0
    ? range(4).map((i) =>
        rect(x + 8 + i * 24, base - h + 8, 10, 6, { fill: T.window, opacity: windows }, 1),
      )
    : []),
];

function skySvg(style: SkyStyle, index: number): string {
  const bandH = (SKY_H - 14) / style.bands.length;
  const body = [
    ...style.bands.map((c, i) => rect(0, i * bandH, SKY_W, bandH + 1, { fill: c })),
    ...(style.sun === 'moon'
      ? [
          ...stars(SKY_W, 50, 70),
          circle(300, 20, 10, { fill: '#fff3c4' }),
          circle(305, 16, 9, { fill: style.bands[0]! }),
        ]
      : style.sun === 'morning'
        ? [
            circle(260, 52, 16, { fill: '#ffe0a3' }),
            circle(260, 52, 24, { fill: '#ffe0a3', opacity: 0.3 }),
          ]
        : [
            circle(300, 18, 12, { fill: '#fff3c4' }),
            circle(300, 18, 19, { fill: '#fff3c4', opacity: 0.3 }),
          ]),
    ...(style.cloud
      ? [
          cloud(80, 26, 1, style.cloud),
          cloud(520, 18, 1.3, style.cloud),
          cloud(900, 30, 0.9, style.cloud),
          cloud(1300, 20, 1.1, style.cloud),
        ]
      : []),
    // 遠くの工場街（2列: 奥は薄く）
    ...range(9).flatMap((i) => block(i * 190 - 60, SKY_H - 10, 16, style.townFar, 0)),
    ...range(8).flatMap((i) => block(i * 210 + 20, SKY_H - 6, 22, style.town, style.windows)),
    // 地面（窓の下の縁）
    rect(0, SKY_H - 8, SKY_W, 8, { fill: shade(style.town) }),
  ];
  return sizedSvg(`上部の帯の景色（${['朝', '昼', '夜'][index]}）`, body, `0 0 ${SKY_W} ${SKY_H}`);
}

/** ロケットの組み立て台（96×64）: 左右の格子の柱・ハザード柄の梁・滑車・フック（ロケットは中に置く） */
function gantrySvg(): string {
  const steel = '#3a404a';
  const tower = (x: number) => [
    rect(x, 8, 10, 56, fill(steel)),
    path(`M${x + 1} 16 L${x + 9} 26 L${x + 1} 36 L${x + 9} 46 L${x + 1} 56`, line(shade(steel), 2)),
  ];
  return sizedSvg(
    'ロケットの組み立て台',
    [
      ...tower(4),
      ...tower(82),
      // 梁（黄と黒の斜めの縞）
      rect(0, 2, 96, 10, fill(BC.hazardBlack)),
      ...range(8).map((i) =>
        polygon(`${2 + i * 12},11 ${8 + i * 12},11 ${14 + i * 12},3 ${8 + i * 12},3`, {
          fill: BC.hazardYellow,
        }),
      ),
      rect(0, 2, 96, 10, { fill: 'none', stroke: O, 'stroke-width': 2.5 }),
      // 滑車とワイヤー・フック（右寄り）
      circle(66, 15, 4, fill(INK.steel, 2)),
      path('M66 19 V30', line(BC.hazardYellow, 1.5)),
      path('M63 30 q3 6 6 0', line(INK.steelLight, 2)),
      // 足もとの台
      rect(0, 60, 96, 4, { fill: shade(steel) }),
    ],
    '0 0 96 64',
  );
}

/** 警告灯（24×20）: 金網のかご・赤いドーム・台座 */
function beaconSvg(): string {
  return sizedSvg(
    '警告灯',
    [
      rect(3, 15, 18, 5, fill('#3a404a', 2), 1),
      path('M5 15 V9 A7 7 0 0 1 19 9 V15 Z', fill(BC.blocked, 2)),
      path('M8 15 V8 M12 15 V3 M16 15 V8 M5 11 H19', line(O, 1.4)),
      path('M8 7 q2 -2 4 -2', { ...line(INK.white, 1.4), opacity: 0.6 }),
    ],
    '0 0 24 20',
  );
}

/** ラン終了画面の発射台（480×150）: 夜空・遠くの工場街・投光器・ハザード柄の発射台（ロケットは画面側で台の上に置く） */
function launchpadSvg(): string {
  const W = 480;
  const style = SKIES[2]!;
  const bandH = 120 / style.bands.length;
  const floodlight = (x: number, flip: boolean) => {
    const d = flip ? -1 : 1;
    return [
      // 台の中央へ向けた淡い光（半透明のフラットな面）
      polygon(`${x + 6 * d},40 ${240 - 70 * d},132 ${240 + 10 * d},132`, {
        fill: '#fff3c4',
        opacity: 0.07,
      }),
      rect(x - 2, 40, 4, 92, { fill: '#2a2f3a' }),
      path(`M${x} 132 L${x - 10} 140 M${x} 132 L${x + 10} 140`, line('#2a2f3a', 3)),
      rect(x - 7, 32, 14, 9, fill('#3a404a', 2), 2),
      rect(x - 5 + 2 * d, 34, 10, 5, { fill: '#fff3c4' }, 1),
    ];
  };
  return sizedSvg(
    'ラン終了画面の発射台',
    [
      ...style.bands.map((c, i) => rect(0, i * bandH, W, bandH + 1, { fill: c })),
      ...stars(W, 100, 40),
      circle(70, 30, 9, { fill: '#fff3c4' }),
      circle(74, 26, 8, { fill: style.bands[0]! }),
      ...range(4).flatMap((i) => block(i * 130 - 30, 132, 18, style.townFar, 0)),
      ...range(3).flatMap((i) => block(i * 170 - 10, 132, 26, style.town, 0.7)),
      ...floodlight(150, false),
      ...floodlight(330, true),
      // 地面
      rect(0, 132, W, 18, { fill: '#1d2028' }),
      path(`M0 132 H${W}`, line('#2c313b', 2)),
      // 発射台（コンクリートの台・縁のハザード柄）
      polygon('180,140 300,140 290,128 190,128', fill('#5b6270', 2.5)),
      ...range(10).map((i) =>
        polygon(`${184 + i * 11},140 ${190 + i * 11},140 ${195 + i * 11},134 ${189 + i * 11},134`, {
          fill: BC.hazardYellow,
        }),
      ),
      path('M182 134 H298', line(O, 1.5)),
    ],
    `0 0 ${W} 150`,
  );
}

export function backdropFiles(): Record<string, string> {
  return {
    ...Object.fromEntries(SKIES.map((s, i) => [`src/assets/backdrop/sky-${i}.svg`, skySvg(s, i)])),
    'src/assets/backdrop/gantry.svg': gantrySvg(),
    'src/assets/backdrop/beacon.svg': beaconSvg(),
    'src/assets/backdrop/launchpad.svg': launchpadSvg(),
  };
}
