/**
 * 工場長とロケットのラフ（段階3）: それぞれ2案
 *
 * - 工場長 1「天井クレーン」: 柱の上の運転席が頭。長い腕（ジブ）とフックで身振りをする
 * - 工場長 2「ボイラー親方」: ずんぐりしたボイラーに2本のクレーン腕。煙突が帽子
 * - ロケット 1「ドラム缶ロケット」: ドラム缶の胴・バケツの先端・洗濯機の扉の窓。継ぎはぎの手作り
 * - ロケット 2「赤白ロケット」: 今の上部の背景のロケットを、テープ・手描きの番号で手作りに寄せたもの
 * 実行: pnpm --filter @chain-factory/client exec tsx art/characters/roughs2.ts（docs/characters/roughs/ に書き出す）
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FAMILY_COLORS as F,
  INK,
  MATERIAL_COLORS as M,
  ROCKET_COLORS as R,
} from '../../src/assets/palette';
import { circle, el, group, line, path, rect, shade, svg } from '../svg';
import { composeBolt, POSES } from './bolt';
import { renderPose, type Pose, type RigPart } from './rig';

const O = INK.outline;
const fill = (color: string, width = 3) => ({
  fill: color,
  stroke: O,
  'stroke-width': width,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
});
const Y = F.hazard.main;

/** 黄黒の警戒の縞（幅 w・高さ h の帯） */
const hazard = (x: number, y: number, w: number, h: number) => {
  const stripes: string[] = [];
  for (let i = -h; i < w; i += 10) {
    stripes.push(path(`M${x + i} ${y + h} l${h} ${-h} h5 l${-h} ${h} Z`, { fill: INK.outline }));
  }
  return [
    el('clipPath', { id: `hz${x}${y}${w}` }, rect(x, y, w, h, {})),
    rect(x, y, w, h, { fill: Y }),
    group({ 'clip-path': `url(#hz${x}${y}${w})` }, ...stripes),
    rect(x, y, w, h, { fill: 'none', stroke: O, 'stroke-width': 2.5 }),
  ];
};

/** 工場長の目（ランプ）: 普段は半分まぶたが下りた不機嫌顔。soft はまぶたが上がり、下に笑いじわ */
const lampEyes = (cx: number, cy: number, gap: number, mood: string | undefined) => {
  const eyes: string[] = [];
  for (const sx of [-1, 1]) {
    const x = cx + sx * gap;
    eyes.push(circle(x, cy, 8, fill(M.sun, 2.5)), circle(x, cy + 1, 3, { fill: O }));
    if (mood === 'soft') {
      eyes.push(
        path(`M${x - 7} ${cy + 11} q7 4 14 0`, { fill: 'none', stroke: O, 'stroke-width': 2 }),
      );
    } else {
      // まぶた（鉄板）: 内側が下がる（気難しい）
      const lid =
        sx < 0
          ? `M${x - 10} ${cy - 9} L${x + 10} ${cy - 3}`
          : `M${x - 10} ${cy - 3} L${x + 10} ${cy - 9}`;
      eyes.push(path(`${lid} L${x + 10 * sx * -1 + 0} ${cy - 12} Z`, { fill: INK.steelDark }));
      eyes.push(path(lid, { fill: 'none', stroke: O, 'stroke-width': 3 }));
    }
  }
  return eyes;
};

// =============================================================================
// 工場長 1: 天井クレーン
// =============================================================================
const MAST_H = 104;
const crane: RigPart[] = [
  { id: 'root', parent: null, pivot: [0, 0], z: 0, draw: () => [] },
  {
    id: 'base',
    parent: 'root',
    pivot: [0, 0],
    z: 1,
    draw: () => [
      rect(-38, -16, 76, 12, fill(INK.steelDark), 3),
      circle(-26, -4, 6, fill(INK.steel, 2.5)),
      circle(0, -4, 6, fill(INK.steel, 2.5)),
      circle(26, -4, 6, fill(INK.steel, 2.5)),
    ],
  },
  {
    id: 'mast',
    parent: 'root',
    pivot: [0, -14],
    z: 2,
    draw: () => [
      rect(-12, -MAST_H, 24, MAST_H, fill(Y), 2),
      // 格子（トラス）
      ...Array.from({ length: 6 }, (_, i) =>
        path(`M-12 ${-i * 17 - 2} L12 ${-i * 17 - 17} M12 ${-i * 17 - 2} L-12 ${-i * 17 - 17}`, {
          fill: 'none',
          stroke: shade(Y),
          'stroke-width': 3,
        }),
      ),
      rect(-12, -MAST_H, 24, MAST_H, { fill: 'none', stroke: O, 'stroke-width': 3 }, 2),
    ],
  },
  {
    id: 'cab',
    parent: 'mast',
    pivot: [0, -MAST_H],
    z: 4,
    draw: (mood) => [
      rect(-30, -44, 60, 44, fill(Y), 6),
      rect(-30, -14, 60, 14, { fill: shade(Y) }, 0),
      rect(-30, -44, 60, 44, { fill: 'none', stroke: O, 'stroke-width': 3.5 }, 6),
      // 窓の帯（目のランプが入る）
      rect(-25, -38, 50, 22, fill(INK.steelDark, 2.5), 4),
      ...lampEyes(0, -27, 12, mood),
      // 口: 通気口のスリット（への字）
      path(mood === 'soft' ? 'M-10 -8 Q0 -4 10 -8' : 'M-10 -6 Q0 -10 10 -6', line(O, 3)),
    ],
  },
  {
    id: 'hat',
    parent: 'cab',
    pivot: [0, -44],
    z: 5,
    // ヘルメット（帽子を上げる＝ヘルメットを持ち上げる）
    draw: () => [
      path('M-26 0 Q-26 -20 0 -20 Q26 -20 26 0 Z', fill(INK.white)),
      rect(-32, -3, 64, 6, fill(INK.white), 3),
      path('M-6 -19 V-3 M6 -19 V-3', line(INK.steelLight, 3)),
    ],
  },
  {
    // 腕（ジブ）: 運転席の横から右へ伸びる。回して指さす・下ろして差し出す・前に折って腕組み
    id: 'jib',
    parent: 'cab',
    pivot: [26, -24],
    z: 3,
    draw: () => [
      rect(0, -7, 78, 14, fill(Y), 2),
      ...Array.from({ length: 5 }, (_, i) =>
        path(`M${i * 15 + 2} 6 L${i * 15 + 15} -6`, {
          fill: 'none',
          stroke: shade(Y),
          'stroke-width': 3,
        }),
      ),
      rect(0, -7, 78, 14, { fill: 'none', stroke: O, 'stroke-width': 3 }, 2),
      circle(0, 0, 6, fill(INK.steelDark, 2.5)),
    ],
  },
  {
    // フック（手）: ジブの先から下がる。hold は部品をつかむ
    id: 'hook',
    parent: 'jib',
    pivot: [72, 6],
    z: 3,
    draw: (v) => [
      path('M0 0 V22', line(O, 2.5)),
      rect(-6, 20, 12, 8, fill(INK.steel, 2.5), 2),
      ...(v === 'hold'
        ? [rect(-16, 30, 32, 18, fill(R.body), 3), rect(-16, 38, 32, 5, { fill: R.accent })]
        : [
            path('M0 28 V36 a7 7 0 1 1 -10 6', {
              fill: 'none',
              stroke: O,
              'stroke-width': 4.5,
              'stroke-linecap': 'round',
            }),
          ]),
    ],
  },
];

// =============================================================================
// 工場長 2: ボイラー親方
// =============================================================================
const boiler: RigPart[] = [
  { id: 'root', parent: null, pivot: [0, 0], z: 0, draw: () => [] },
  {
    id: 'tracks',
    parent: 'root',
    pivot: [0, 0],
    z: 1,
    draw: () => [
      rect(-46, -18, 92, 18, fill(INK.outline), 9),
      ...[-34, -17, 0, 17, 34].map((x) => circle(x, -9, 5, fill(INK.steelDark, 2))),
    ],
  },
  {
    id: 'body',
    parent: 'root',
    pivot: [0, -16],
    z: 2,
    draw: (mood) => [
      // ボイラーの胴（ずんぐりした缶）
      rect(-40, -96, 80, 96, fill(Y), 22),
      path('M-40 -30 H40 V-22 a22 22 0 0 1 -22 22 H-18 a22 22 0 0 1 -22 -22 Z', { fill: shade(Y) }),
      rect(-40, -96, 80, 96, { fill: 'none', stroke: O, 'stroke-width': 3.5 }, 22),
      ...hazard(-40, -40, 80, 8),
      // 顔: 2つのランプの目・圧力計の鼻・パイプのひげ
      ...lampEyes(0, -70, 15, mood),
      circle(0, -55, 6, fill(INK.white, 2.5)),
      path('M0 -55 L3 -58', line(R.accent, 2)),
      path(
        mood === 'soft'
          ? 'M-22 -46 Q-10 -40 0 -46 Q10 -40 22 -46'
          : 'M-22 -42 Q-10 -48 0 -44 Q10 -48 22 -42',
        line(INK.steelDark, 5),
      ),
      // リベット
      ...[-30, 30].map((x) => circle(x, -86, 2, { fill: O })),
    ],
  },
  {
    id: 'hat',
    parent: 'body',
    pivot: [10, -96],
    z: 1,
    // 煙突（帽子）: ふたを上げる
    draw: () => [
      rect(-8, -26, 16, 28, fill(INK.steelDark), 2),
      rect(-12, -32, 24, 8, fill(INK.steel), 2),
    ],
  },
  ...(['L', 'R'] as const).flatMap((side): RigPart[] => {
    const sx = side === 'L' ? -1 : 1;
    return [
      {
        id: `upper${side}`,
        parent: 'body',
        pivot: [38 * sx, -66],
        z: 3,
        draw: () => [
          rect(-7, -7, 14, 40, fill(INK.steel), 7),
          circle(0, 0, 8, fill(INK.steelDark, 2.5)),
        ],
      },
      {
        id: `lower${side}`,
        parent: `upper${side}`,
        pivot: [0, 33],
        z: 3,
        draw: () => [rect(-6, -6, 12, 34, fill(Y), 6), circle(0, 0, 6, fill(INK.steelDark, 2.5))],
      },
      {
        id: `claw${side}`,
        parent: `lower${side}`,
        pivot: [0, 30],
        z: 4,
        // はさみの手（point は片方を伸ばす）
        draw: (v) =>
          v === 'point'
            ? [rect(-3, 0, 6, 22, fill(INK.steelLight, 2.5), 3)]
            : [
                path('M-3 0 L-10 12 L-4 20 M3 0 L10 12 L4 20', {
                  fill: 'none',
                  stroke: O,
                  'stroke-width': 6,
                  'stroke-linecap': 'round',
                }),
                path('M-3 0 L-10 12 L-4 20 M3 0 L10 12 L4 20', line(INK.steelLight, 3)),
              ],
      },
    ];
  }),
];

// =============================================================================
// ロケット 1: ドラム缶ロケット / ロケット 2: 赤白ロケット（どちらも 9 部品）
// =============================================================================
type Piece = (built: boolean) => string;
const ghost = { fill: 'none', stroke: R.ghost, 'stroke-width': 2, 'stroke-dasharray': '3 3' };
const look = (built: boolean, color: string) => (built ? fill(color) : ghost);

/** ドラム缶ロケット: 1日目 = ノズル（じょうご）・左右の翼（看板の板）／2日目 = ドラム缶3段／3日目 = 窓（洗濯機の扉）・バケツの先端・アンテナ */
const DRUM: Piece[] = [
  (b) => path('M-12 70 H12 L18 86 H-18 Z', look(b, INK.steel)),
  (b) => path('M-22 40 L-40 66 L-36 80 L-22 70 Z', look(b, F.multiplier.main)),
  (b) => path('M22 40 L40 66 L36 80 L22 70 Z', look(b, F.multiplier.main)),
  (b) => rect(-22, 44, 44, 26, look(b, R.accent), 4),
  (b) => rect(-22, 18, 44, 26, look(b, F.retrigger.main), 4),
  (b) => rect(-22, -8, 44, 26, look(b, R.body), 4),
  (b) =>
    b
      ? group({}, circle(0, 31, 10, fill(INK.steelLight)), circle(0, 31, 6, fill(R.window, 2)))
      : circle(0, 31, 10, ghost),
  (b) => path('M-20 -8 L-14 -36 H14 L20 -8 Z', look(b, Y)),
  (b) =>
    b
      ? group({}, path('M0 -36 V-50', line(O, 3)), circle(0, -52, 4, fill(R.lamp, 2)))
      : path('M0 -36 V-50', ghost),
];

/** 赤白ロケット: 今の背景のロケットを手作りに寄せる（テープの継ぎ目・手描きの番号） */
const RED: Piece[] = [
  (b) => path('M-10 80 H10 L14 92 H-14 Z', look(b, INK.steel)),
  (b) => path('M-14 50 L-34 76 V90 L-14 80 Z', look(b, R.accent)),
  (b) => path('M14 50 L34 76 V90 L14 80 Z', look(b, R.accent)),
  (b) => path('M-16 52 H16 V80 H-16 Z', look(b, R.body)),
  (b) => path('M-16 24 H16 V52 H-16 Z', look(b, R.body)),
  (b) => path('M-16 0 H16 V24 H-16 Z', look(b, R.body)),
  (b) =>
    b
      ? group(
          {},
          circle(0, 18, 8, fill(R.window)),
          path('M-16 36 H16', line(INK.steelLight, 4)),
          path('M-6 64 h4 v10 M4 64 h4 l-4 10', line(R.accent, 2)),
        )
      : circle(0, 18, 8, ghost),
  (b) => path('M-16 0 Q-14 -26 0 -40 Q14 -26 16 0 Z', look(b, R.accent)),
  (b) =>
    b
      ? group({}, path('M0 -40 V-50', line(O, 3)), circle(0, -52, 4, fill(R.lamp, 2)))
      : path('M0 -40 V-50', ghost),
];

const rocketSvg = (pieces: Piece[], built: number, label: string) =>
  svg(
    `ロケットのラフ ${label}: ${built}/9`,
    pieces.map((p, i) => p(i < built)),
    '-50 -64 100 168',
  );

// =============================================================================
// 書き出し
// =============================================================================
/** ボルトと並べて大きさの関係を見せる（ボルトはクレーンの足もとに立つ） */
function withBolt(
  rig: RigPart[],
  pose: Pose,
  boltX: number,
  boltPose = POSES.stand!.pose,
): string[] {
  return [
    el('ellipse', { cx: 0, cy: 2, rx: 46, ry: 5, fill: INK.black, opacity: 0.25 }),
    ...renderPose(rig, pose),
    // ボルト（0.9 倍・腰が原点なので地面に合わせる）
    group({ transform: `translate(${boltX} -26) scale(0.9)` }, ...composeBolt(boltPose, true)),
  ];
}

const QUOTA_BOX = (x: number) =>
  group(
    { transform: `translate(${x} 0)` },
    rect(-14, -24, 28, 24, fill(M.cardboard), 2),
    path('M-14 -16 H14', line(M.cardboardDark, 2)),
    path('M-6 -10 h12', line(O, 2)),
  );

export function rough2Files(): Record<string, string> {
  const files: Record<string, string> = {};
  const box = '-140 -200 280 210';
  const cranePoses: Record<string, Pose> = {
    neutral: { variants: { cab: 'stern' } },
    // 指さす: ジブを下へ向けてノルマの箱を指す
    point: { angles: { jib: 30, cab: 4 }, variants: { cab: 'stern' } },
    // 首を振る: 運転席を傾けて（効果の線は省略）
    shake: { angles: { cab: -12, jib: 8 }, variants: { cab: 'stern' } },
    // 帽子を上げる: ヘルメットを持ち上げ、目が和らぐ
    tip: { offsets: { hat: [0, -14] }, angles: { hat: -12, jib: -20 }, variants: { cab: 'soft' } },
    // 差し出す: フックを下ろしてロケットの部品を渡す
    offer: { angles: { jib: 55, hook: -55 }, variants: { cab: 'stern', hook: 'hold' } },
  };
  for (const [key, pose] of Object.entries(cranePoses)) {
    files[`chief1-${key}.svg`] = svg(
      `工場長 1（天井クレーン）: ${key}`,
      [...(key === 'point' ? [QUOTA_BOX(96)] : []), ...withBolt(crane, pose, -76)],
      box,
    );
  }
  const boilerPoses: Record<string, Pose> = {
    // 腕を組む: 両腕を胴の前で交差
    neutral: {
      angles: { upperL: -50, lowerL: -80, upperR: 50, lowerR: 80 },
      variants: { body: 'stern' },
    },
    point: {
      angles: { upperL: 20, lowerL: -10, upperR: -110, lowerR: 0 },
      variants: { body: 'stern', clawR: 'point' },
    },
    shake: { angles: { body: -8, upperL: 20, upperR: -20 }, variants: { body: 'stern' } },
    tip: {
      offsets: { hat: [0, -14] },
      angles: { upperL: 20, upperR: -150, lowerR: 30 },
      variants: { body: 'soft' },
    },
    offer: { angles: { upperL: 15, upperR: -60, lowerR: -30 }, variants: { body: 'stern' } },
  };
  for (const [key, pose] of Object.entries(boilerPoses)) {
    files[`chief2-${key}.svg`] = svg(
      `工場長 2（ボイラー親方）: ${key}`,
      [...(key === 'point' ? [QUOTA_BOX(100)] : []), ...withBolt(boiler, pose, -86)],
      box,
    );
  }
  for (const built of [3, 6, 9]) {
    files[`rocket1-${built}.svg`] = rocketSvg(DRUM, built, '1（ドラム缶）');
    files[`rocket2-${built}.svg`] = rocketSvg(RED, built, '2（赤白）');
  }
  return files;
}

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../../../docs/characters/roughs');
mkdirSync(out, { recursive: true });
for (const [name, content] of Object.entries(rough2Files()))
  writeFileSync(resolve(out, name), content);
console.log(`wrote ${out}`);
