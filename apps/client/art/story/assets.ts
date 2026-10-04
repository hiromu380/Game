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
import { nutRocketBody } from '../characters/nutRocket';
import { rocketBody } from '../rocket';
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

/** 歯車（cx, cy: 中心、r: 半径） */
const gear = (cx: number, cy: number, r: number, color: string) => [
  ...Array.from({ length: 8 }, (_, i) =>
    rect(cx - r * 0.18, cy - r * 1.22, r * 0.36, r * 0.5, {
      ...fill(color, 2.5),
      transform: `rotate(${i * 45} ${cx} ${cy})`,
    }),
  ),
  circle(cx, cy, r, fill(color)),
  circle(cx, cy, r * 0.35, fill(INK.steelDark, 2.5)),
];

/** ガラクタの山（部品が突き出た山。手前に設計図の端がのぞく） */
const junk = () => [
  // 奥: 突き出た管・ばね・車輪
  path('M70 70 L40 10', line(INK.steelDark, 14)),
  path('M70 70 L40 10', line(INK.steel, 8)),
  path('M236 74 q10 -10 0 -18 q-10 -8 0 -16 q10 -8 0 -16', line(INK.steelLight, 5)),
  ...gear(250, 96, 26, INK.steel),
  // 山
  path('M6 186 Q30 112 92 98 Q150 60 214 92 Q282 110 304 186 Z', fill(INK.steelDark)),
  path('M30 186 Q60 140 110 130 M180 120 Q240 130 280 186', line(INK.steel, 3)),
  // 手前のガラクタ
  ...gear(92, 128, 22, INK.steelLight),
  rect(150, 104, 54, 34, fill(R.accent), 4),
  path('M150 116 H204', line(R.accentShade, 3)),
  circle(220, 160, 18, fill(O, 3)),
  circle(220, 160, 8, fill(INK.steelLight, 2.5)),
  rect(36, 150, 40, 20, fill(INK.steel), 3),
  polygon('120,186 146,140 172,186', fill(M.cardboard)),
  // 設計図の端（青い紙の角がのぞく）
  path('M118 176 L136 150 L184 158 L176 186 Z', fill(R.window, 2.5)),
  path('M140 160 l20 4', line(INK.white, 2)),
];

/** 設計図のアップ（広げた瞬間に画面いっぱいに見せる）: 方眼の青い紙に、ロケットの図面と寸法の線 */
const blueprintClose = () => {
  const ink = { fill: 'none', stroke: INK.white, 'stroke-width': 4, 'stroke-linejoin': 'round' };
  const thin = { fill: 'none', stroke: INK.white, 'stroke-width': 2, opacity: 0.7 };
  return [
    rect(8, 8, 704, 444, fill('#2f6fb0', 6), 10),
    ...Array.from({ length: 13 }, (_, i) =>
      path(`M${30 + i * 55} 20 V440`, { ...thin, opacity: 0.18 }),
    ),
    ...Array.from({ length: 8 }, (_, i) =>
      path(`M20 ${30 + i * 55} H700`, { ...thin, opacity: 0.18 }),
    ),
    // ロケットの図面（art/rocket.ts と同じ形を線で: 赤いバケツの先端・窓・ドラム缶・じょうごのノズル・翼）
    group(
      { transform: 'translate(250 30) scale(4)' },
      path('M20 32 C20 20 27 10 32 5 C37 10 44 20 44 32 Z', { ...ink, 'stroke-width': 1 }),
      path('M32 5 V-1', { ...ink, 'stroke-width': 1 }),
      circle(32, -3.5, 3, { ...ink, 'stroke-width': 1 }),
      rect(20, 32, 24, 48, { ...ink, 'stroke-width': 1 }),
      circle(32, 53, 8.5, { ...ink, 'stroke-width': 1 }),
      path('M20 66 H44 M20 76 H44', { ...thin, 'stroke-width': 0.6 }),
      path('M22 56 L8 74 V86 L22 80 Z M42 56 L56 74 V86 L42 80 Z', { ...ink, 'stroke-width': 1 }),
      path('M24 80 H40 L44 90 H20 Z', { ...ink, 'stroke-width': 1 }),
    ),
    // 寸法の線と引き出し線（文字は使わない）
    path('M200 46 V390 M190 46 H210 M190 390 H210', thin),
    path('M250 420 H490 M250 410 V430 M490 410 V430', thin),
    path('M400 240 L560 170 H640', thin),
    circle(600, 120, 34, thin),
    path('M584 120 h32 M600 104 v32', thin),
    // 角に「完成予定」の星（ゴールの印）
    polygon(
      '640,330 652,358 682,358 658,376 667,404 640,388 613,404 622,376 598,358 628,358',
      fill(M.sun, 3),
    ),
  ];
};

/** ロケット（窓の中は空。乗り込む前）: art/rocket.ts の絵を4倍で */
const rocketEmpty = (stage: number) => () => [
  group({ transform: 'scale(4) translate(16 8)' }, ...rocketBody(stage, true)),
];

/** 工場長の吹き出し（取引の条件）: ノルマの箱 → 部品（文字なし）。しっぽは右下（工場長の運転席）へ */
const bubbleDeal = () => [
  path('M300 150 L370 196 L320 140 Z', fill(INK.white, 3)),
  rect(10, 10, 320, 150, fill(INK.white, 3), 40),
  // ノルマの箱（段ボール）
  rect(40, 50, 84, 70, fill(M.cardboard), 6),
  path('M40 74 H124', line(M.cardboardDark, 5)),
  path('M64 96 h36', line(O, 5)),
  // チェックの印（届けたら）
  path('M98 36 l10 12 l20 -26', line('#43a047', 7)),
  // 矢印
  path('M146 86 H196', line(O, 7)),
  polygon('196,70 220,86 196,102', { fill: O }),
  // ロケットの部品（胴体の輪切り: ボルトが抱える部品と同じ絵）
  rect(236, 58, 70, 48, fill(R.body), 6),
  rect(236, 76, 70, 12, { fill: R.accent }),
  rect(236, 58, 70, 48, { fill: 'none', stroke: O, 'stroke-width': 3 }, 6),
];

/** ボルトの考えの吹き出し: 部品をいくつも重ねる → ロケット（ふわふわの雲の形、しっぽは左下の小さな丸） */
const bubbleBuild = () => [
  circle(26, 222, 9, fill(INK.white, 2.5)),
  circle(50, 196, 14, fill(INK.white, 2.5)),
  el('ellipse', { cx: 190, cy: 100, rx: 170, ry: 92, ...fill(INK.white, 3) }),
  // 部品3つ（積み上がる）
  ...[0, 1, 2].map((i) =>
    group(
      {},
      rect(60, 120 - i * 34, 64, 30, fill(R.body), 5),
      rect(60, 131 - i * 34, 64, 8, { fill: R.accent }),
      rect(60, 120 - i * 34, 64, 30, { fill: 'none', stroke: O, 'stroke-width': 3 }, 5),
    ),
  ),
  path('M144 100 H190', line(O, 7)),
  polygon('190,84 214,100 190,116', { fill: O }),
  // 完成したロケット（窓は空: これから乗る）
  group({ transform: 'translate(234 22) scale(1.5)' }, ...rocketBody(9, true)),
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
    'stroke-width': 30,
    opacity: 0.5,
    filter: 'url(#kv-glow)',
    'stroke-linecap': 'round',
  }),
  path('M10 20 H590', line(color, 12)),
  path('M10 20 H590', line('#fff3c4', 4)),
];

/** 柱に貼った古い写真（ナット＝水色のアンテナのロボ と、別の手作りの水色のロケット。art/characters/nut.ts） */
const photo = () => [
  rect(6, 6, 228, 186, fill(M.paper, 4), 4),
  rect(20, 20, 200, 136, { fill: '#2a3150' }),
  ...stars(200, 100, 10).map((s) => group({ transform: 'translate(20 20)' }, s)),
  // ナット（設定画の「手を振る」ポーズ。写真の中なので小さく、影なし）
  group({ transform: 'translate(82 132) scale(0.6)' }, ...composeNut(NUT_POSES.wave!.pose, false)),
  // ナットのロケット（ボルトのものより性能が良さそうな機体: art/characters/nutRocket.ts）
  group({ transform: 'translate(132 22) scale(0.6)' }, ...nutRocketBody()),
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
  'blueprint-close': { w: 720, h: 460, body: blueprintClose },
  'rocket-empty-8': { w: 384, h: 416, body: rocketEmpty(8) },
  'rocket-empty-9': { w: 384, h: 416, body: rocketEmpty(9) },
  // 場面の上に重ねて暗くする（設計図のアップなど。不透明度はシーン側で）
  // 名札（登場人物の初登場で、名前の文字の下に敷く。文字は i18n の文言）
  nameplate: {
    w: 240,
    h: 64,
    body: () => [
      rect(4, 4, 232, 56, fill('#1b1f27', 4), 12),
      rect(14, 14, 8, 36, { fill: M.sun }, 3),
    ],
  },
  dim: { w: 64, h: 36, body: () => [rect(0, 0, 64, 36, { fill: '#05060a' })] },
  'bubble-deal': { w: 380, h: 200, body: bubbleDeal },
  'bubble-build': { w: 370, h: 240, body: bubbleBuild },
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
