/**
 * カットシーンの背景・小物（art/story/storyboard.ts の絵コンテの絵を、シーンの座標 1280×720 で描き直す）
 *
 * キャラクターは切り絵の部品（art/characters）、ロケットは上部の背景と同じ絵（art/rocket.ts）を使う。
 * ここで描くのは、それ以外の背景・小物だけ。書き出し先: src/assets/story/<名前>.svg（大きさつき）
 */
import {
  BOARD_COLORS as BC,
  FAMILY_COLORS as F,
  INK,
  MATERIAL_COLORS as M,
  ROCKET_COLORS as R,
  SIGNAL_TIERS,
  TITLE_COLORS as T,
} from '../../src/assets/palette';
import { composeNut, NUT_POSES } from '../characters/nut';
import { duskSky, factoryRow, filters, stars } from '../keyvisual/layers';
import { circle, el, group, line, path, polygon, rect, sizedSvg } from '../svg';

const O = INK.outline;
const fill = (color: string, width = 3) => ({
  fill: color,
  stroke: O,
  'stroke-width': width,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
});

const W = 1280;
const H = 720;

/** 夜空（夕暮れの帯・星・地平線の光） */
const nightSky = () => [filters(2), ...duskSky(W, H, 560), ...stars(W, 520, 90)];

/** 工場街のシルエット（横に並べる帯。下端が地面） */
const town = () => [...factoryRow(300, W, 1.6)];

/** 工場の中（壁・窓・床・警戒線） */
const workshop = () => [
  rect(0, 0, W, H, { fill: BC.background }),
  // 高い窓から夜空
  ...[160, 520, 880].map((x) =>
    group(
      {},
      rect(x, 90, 240, 170, fill('#1c2040', 6), 8),
      ...stars(240, 170, 12).map((s) => group({ transform: `translate(${x} 90)` }, s)),
      path(`M${x + 120} 90 V260 M${x} 175 H${x + 240}`, line(BC.floorLine, 6)),
    ),
  ),
  rect(0, 600, W, 120, { fill: BC.floorA }),
  path('M0 600 H1280', line(BC.hazardYellow, 8)),
  ...Array.from({ length: 16 }, (_, i) => path(`M${i * 80 + 40} 640 h30`, line(BC.floorLine, 4))),
];

/** 屋根（腰かける縁・はしご） */
const roof = () => [
  rect(0, 0, W, 200, { fill: T.factory }),
  rect(0, 0, W, 14, { fill: T['factory-edge'] }),
  ...Array.from({ length: 10 }, (_, i) => rect(i * 140 + 30, 40, 60, 40, { fill: '#1a1d26' }, 4)),
];

const ladder = () => [
  path('M10 0 V400 M50 0 V400', line(INK.steelDark, 8)),
  ...Array.from({ length: 10 }, (_, i) => path(`M10 ${i * 40 + 20} H50`, line(INK.steel, 6))),
];

/** ガラクタの山（設計図が埋まっている） */
const junk = () => [
  path('M10 180 Q60 60 150 70 Q240 40 300 180 Z', fill(INK.steelDark)),
  circle(110, 120, 26, fill(INK.steel)),
  circle(110, 120, 8, { fill: O }),
  rect(170, 80, 50, 34, fill(R.accent), 4),
  rect(60, 140, 70, 24, fill(R.window), 3),
  path('M220 140 l40 -30', line(INK.steelLight, 8)),
  polygon('240,170 270,120 290,175', fill(M.cardboard)),
];

/** 地面に落ちた設計図（ゲームオーバーで拾う） */
const blueprintGround = () => [
  path('M4 40 L20 6 H116 L100 40 Z', fill(R.window, 2.5)),
  path('M50 14 q8 8 6 20 h-12 q-2 -12 6 -20 Z', line(INK.steelDark, 2)),
];

/** ノルマの箱（段ボール） */
const quotaBox = () => [
  rect(4, 10, 92, 76, fill(M.cardboard), 6),
  path('M4 36 H96', line(M.cardboardDark, 5)),
  path('M30 58 h40', line(O, 5)),
];

/** 絵の吹き出し（ロケットと星）: 中身は1枚の絵として描く */
const bubble = () => [
  circle(30, 205, 10, fill(INK.white, 2.5)),
  circle(58, 180, 15, fill(INK.white, 2.5)),
  el('ellipse', { cx: 150, cy: 95, rx: 140, ry: 90, ...fill(INK.white, 3) }),
  // ロケット（簡略）
  path('M120 150 Q118 90 135 50 Q152 90 150 150 Z', fill(R.body, 2.5)),
  path('M120 130 L104 158 H120 Z M150 130 L166 158 H150 Z', fill(R.accent, 2.5)),
  circle(135, 100, 8, fill(R.window, 2)),
  path('M135 50 Q140 70 150 80', line(R.accent, 6)),
  // 星
  polygon(
    '225,40 232,60 253,60 236,72 243,92 225,80 207,92 214,72 197,60 218,60',
    fill(M.sun, 2.5),
  ),
];

/** 流れ星（光の尾） */
const shootingStar = () => [
  filters(1.5),
  el('path', {
    d: 'M10 10 L280 50',
    stroke: SIGNAL_TIERS[0],
    'stroke-width': 10,
    opacity: 0.4,
    filter: 'url(#kv-glow)',
    'stroke-linecap': 'round',
  }),
  path('M10 10 L280 50', line(INK.white, 3)),
  circle(282, 50, 6, { fill: INK.white }),
];

/** 月面（遠くに地球）。下の地面は y 520 から */
const moon = () => [
  rect(0, 0, W, H, { fill: '#0b1026' }),
  ...stars(W, 500, 120),
  circle(170, 130, 54, fill('#3d6fb6', 4)),
  path('M126 112 q24 -16 40 6 q16 16 40 0', line('#69f0ae', 8)),
  path('M0 540 Q300 480 640 520 T1280 500 V720 H0 Z', fill('#cfd3dc', 4)),
  ...[
    [260, 620, 34],
    [900, 640, 44],
    [1150, 590, 22],
  ].map(([x, y, r]) => el('ellipse', { cx: x, cy: y, rx: r, ry: r! * 0.4, fill: '#b0b5c1' })),
];

/** 地平線の向こうの、見知らぬ工場（窓が lit 個灯る） */
const farFactory = (lit: number) => [
  path('M0 120 V70 L30 46 V70 L60 46 V70 L90 46 V30 H110 V70 H200 V120 Z', fill('#1a1d2e', 3)),
  ...Array.from({ length: 5 }, (_, i) =>
    rect(14 + i * 36, 84, 18, 14, { fill: i < lit ? M.sun : '#2a3150' }, 2),
  ),
];

/** 見知らぬロボのアンテナの光（水色） */
const strangerLamp = (on: boolean) => [
  filters(1),
  ...(on
    ? [
        el('circle', {
          cx: 30,
          cy: 30,
          r: 26,
          fill: F.retrigger.main,
          opacity: 0.55,
          filter: 'url(#kv-glow)',
        }),
      ]
    : []),
  path('M30 40 V80', line('#2a3150', 5)),
  circle(30, 30, 9, fill(on ? F.retrigger.light : '#2a3150', 2.5)),
];

/** 光の線（連鎖の信号。ゲームの光と同じ色） */
const lightLine = (color: string) => [
  filters(1),
  el('path', {
    d: 'M10 20 H590',
    stroke: color,
    'stroke-width': 18,
    opacity: 0.45,
    filter: 'url(#kv-glow)',
    'stroke-linecap': 'round',
  }),
  path('M10 20 H590', line(color, 7)),
  path('M10 20 H590', line('#fff3c4', 2.5)),
];

/** 柱に貼った古い写真（ナット＝水色のアンテナのロボ と、別の手作りの水色のロケット。art/characters/nut.ts） */
const photo = () => [
  rect(6, 6, 228, 186, fill(M.paper, 4), 4),
  rect(20, 20, 200, 136, { fill: '#2a3150' }),
  ...stars(200, 100, 10).map((s) => group({ transform: 'translate(20 20)' }, s)),
  // ナット（設定画の「手を振る」ポーズ。写真の中なので小さく、影なし）
  group({ transform: 'translate(82 132) scale(0.6)' }, ...composeNut(NUT_POSES.wave!.pose, false)),
  path('M160 40 Q184 64 184 100 V140 H136 V100 Q136 64 160 40 Z', fill(F.retrigger.light, 3)),
  path('M136 118 L118 146 H136 Z M184 118 L202 146 H184 Z', fill(F.retrigger.main, 3)),
  circle(160, 92, 11, fill(R.window, 2.5)),
  circle(120, 8, 8, fill(INK.steelLight, 2.5)),
];

/** ロケットの部品の破片（崩れる場面） */
const scrap = () => [
  rect(4, 10, 60, 30, fill(R.body), 4),
  rect(4, 22, 60, 8, { fill: R.accent }),
  path('M70 40 L96 6 L104 14 L80 44 Z', fill(R.accent)),
  circle(120, 28, 12, fill(INK.steel)),
];

/** 地球の工場の夜（ロゴのあとの場面の背景: 少し冷たい色） */
const earthNight = () => [...nightSky(), rect(0, 0, W, H, { fill: '#0d1b2a', opacity: 0.35 })];

const ASSETS: Record<string, { w: number; h: number; body: () => string[] }> = {
  'night-sky': { w: W, h: H, body: nightSky },
  'earth-night': { w: W, h: H, body: earthNight },
  town: { w: W, h: 300, body: town },
  workshop: { w: W, h: H, body: workshop },
  roof: { w: W, h: 200, body: roof },
  ladder: { w: 60, h: 400, body: ladder },
  junk: { w: 310, h: 190, body: junk },
  'blueprint-ground': { w: 120, h: 46, body: blueprintGround },
  'quota-box': { w: 100, h: 90, body: quotaBox },
  bubble: { w: 300, h: 220, body: bubble },
  'shooting-star': { w: 300, h: 60, body: shootingStar },
  moon: { w: W, h: H, body: moon },
  ...Object.fromEntries(
    [0, 1, 2, 3, 4, 5].map((n) => [
      `far-factory-${n}`,
      { w: 200, h: 124, body: () => farFactory(n) },
    ]),
  ),
  'stranger-lamp-on': { w: 60, h: 84, body: () => strangerLamp(true) },
  'stranger-lamp-off': { w: 60, h: 84, body: () => strangerLamp(false) },
  'light-line': { w: 600, h: 40, body: () => lightLine(SIGNAL_TIERS[3]!) },
  photo: { w: 240, h: 198, body: photo },
  scrap: { w: 136, h: 48, body: scrap },
};

export const STORY_ASSET_KEYS = Object.keys(ASSETS);

export function storyAssetFiles(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(ASSETS).map(([name, a]) => [
      `src/assets/story/${name}.svg`,
      sizedSvg(`カットシーンの絵: ${name}`, a.body(), `0 0 ${a.w} ${a.h}`),
    ]),
  );
}
