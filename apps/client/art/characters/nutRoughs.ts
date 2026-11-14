/**
 * 見知らぬロボ「ナット」（仮名）の体型 3案（ラフ）
 *
 * エンディングの伏線（遠くの工場のアンテナの光・工場長の古い写真）にだけ出る、ボルトより先に月へ行った先輩。
 * ボルト（緑・四角い頭・左右で違う目）とシルエットと色で見分けられるよう、
 * 六角ナットの頭・大きな1つ目のレンズ・高いアンテナの水色のランプ・旅人のマフラーを共通の特徴にする。
 *
 * - A「旅人」: 細長い二本脚（約 3 頭身）。マフラーが風になびく
 * - B「浮遊」: 体の下に噴射口（すでに空を飛んだことがある）
 * - C「一輪」: 車輪で走る（工場の機械らしさ）
 * 実行: pnpm --filter @chain-factory/client exec tsx art/characters/nutRoughs.ts（docs/characters/roughs/ に書き出す）
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { INK, NUT_COLORS as N, ROCKET_COLORS as R } from '../../src/assets/palette';
import { circle, el, group, line, path, polygon, rect, shade, svg } from '../svg';
import { composeBolt, POSES } from './bolt';
import { renderPose, type Pose, type RigPart } from './rig';

const O = N.outline;
const fill = (color: string, width = 3) => ({
  fill: color,
  stroke: O,
  'stroke-width': width,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
});
const limb = (len: number, width: number, color: string) => [
  rect(-width / 2, -width / 2, width, len + width, fill(color), width / 2),
];

/** 六角ナットの頭（首の関節が原点。上へ伸びる）。look は黒目の位置（0 = 正面、-1 = 上） */
const head = (variant: string | undefined): string[] => {
  const look = variant === 'up' ? -4 : variant === 'down' ? 3 : 0;
  const glow = variant === 'up' || variant === 'lit';
  return [
    // アンテナ（高い）とランプ（伏線の水色の光）
    path('M4 -48 V-74', line(O, 3)),
    ...(glow ? [el('circle', { cx: 4, cy: -78, r: 11, fill: N.lamp, opacity: 0.45 })] : []),
    circle(4, -78, 5.5, fill(N.lamp, 2.5)),
    // 六角の頭
    polygon('-27,-25 -14,-48 14,-48 27,-25 14,-2 -14,-2', fill(N.body, 3.5)),
    polygon('-20,-25 -10,-42 10,-42 20,-25 10,-8 -10,-8', {
      fill: 'none',
      stroke: N.bodyLight,
      'stroke-width': 2,
    }),
    path('M-27 -25 L-14 -2 H14 L27 -25', { fill: shade(N.body), opacity: 0.5 }),
    // 1つ目のレンズ
    circle(0, -26, 13, fill(N.lensRing, 3)),
    circle(0, -26, 9, { fill: N.lens }),
    circle(0, -26 + look, 4.5, { fill: O }),
    circle(-3, -29 + look, 1.6, { fill: INK.white }),
    // 側面のネジ
    circle(-21, -12, 1.8, { fill: O }),
    circle(21, -12, 1.8, { fill: O }),
  ];
};

/** 胴（細身の台形）とマフラー */
const torso = (lower: 'legs' | 'hover' | 'wheel') => (): string[] => {
  const bottom = lower === 'legs' ? 16 : 20;
  // 腰が原点。胴は上へ（肩 y = -36）
  return [
    rect(-4, -44, 8, 9, fill(INK.steelDark, 2.5), 2),
    path(`M-15 -36 H15 L${bottom / 2 + 2} 0 H${-bottom / 2 - 2} Z`, fill(N.body)),
    path(`M-12 -13 H12 L${bottom / 2 + 1} -1 H${-bottom / 2 - 1} Z`, { fill: shade(N.body) }),
    // 胸の丸いメーター（ボルトは針、ナットは方位磁針: 旅人の記号）
    circle(0, -22, 6, fill(INK.white, 2)),
    path('M0 -27 L2 -22 L0 -17 L-2 -22 Z', { fill: R.accent }),
  ];
};

/** マフラー（首に巻き、片側が風になびく）。wind は なびく向き（1 = 右） */
const scarf = (variant: string | undefined): string[] => {
  const w = variant === 'still' ? 0 : 1;
  return [
    rect(-17, -6, 34, 9, fill(N.scarf, 2.5), 4),
    path(
      `M10 1 q${12 + w * 10} ${4 - w * 6} ${26 + w * 16} ${2 - w * 10} l-3 9 q-12 2 -24 -2 Z`,
      fill(N.scarf, 2.5),
    ),
    path('M12 3 l4 6 M20 2 l4 6', line(N.scarfShade, 2)),
  ];
};

const hand = (variant: string | undefined): string[] =>
  variant === 'point'
    ? [rect(-2.5, 4, 5, 13, fill(INK.steelLight, 2.5), 2.5), circle(0, 4, 6, fill(INK.steelLight))]
    : [circle(0, 5, 6.5, fill(INK.steelLight))];

function upper(lower: 'legs' | 'hover' | 'wheel'): RigPart[] {
  return [
    { id: 'root', parent: null, pivot: [0, 0], z: 0, draw: () => [] },
    { id: 'torso', parent: 'root', pivot: [0, -34], z: 2, draw: torso(lower) },
    { id: 'head', parent: 'torso', pivot: [0, -44], z: 5, draw: head },
    { id: 'scarf', parent: 'torso', pivot: [0, -38], z: 6, draw: scarf },
    ...(['L', 'R'] as const).flatMap((side): RigPart[] => {
      const x = side === 'L' ? -15 : 15;
      return [
        {
          id: `upperArm${side}`,
          parent: 'torso',
          pivot: [x, -32],
          z: 3,
          draw: () => limb(15, 8, INK.steel),
        },
        {
          id: `foreArm${side}`,
          parent: `upperArm${side}`,
          pivot: [0, 15],
          z: 3,
          draw: () => limb(13, 7, INK.steel),
        },
        { id: `hand${side}`, parent: `foreArm${side}`, pivot: [0, 14], z: 4, draw: hand },
      ];
    }),
  ];
}

// ---- 下半身 ----
const longLegs: RigPart[] = (['L', 'R'] as const).flatMap((side): RigPart[] => {
  const x = side === 'L' ? -7 : 7;
  return [
    {
      id: `thigh${side}`,
      parent: 'root',
      pivot: [x, -34],
      z: 1,
      draw: () => limb(16, 8, INK.steelDark),
    },
    {
      id: `shin${side}`,
      parent: `thigh${side}`,
      pivot: [0, 16],
      z: 1,
      draw: () => limb(14, 7, INK.steel),
    },
    {
      id: `foot${side}`,
      parent: `shin${side}`,
      pivot: [0, 15],
      z: 1,
      draw: () => [
        path(
          `M-6 -1 H6 Q${side === 'L' ? -10 : 10} 0 ${side === 'L' ? -9 : 9} 5 H${side === 'L' ? 6 : -6} Z`,
          fill(N.scarf, 2.5),
        ),
      ],
    },
  ];
});

const hover: RigPart[] = [
  {
    id: 'nozzle',
    parent: 'root',
    pivot: [0, -34],
    z: 1,
    draw: () => [
      path('M-9 0 H9 L6 9 H-6 Z', fill(INK.steelDark, 2.5)),
      path('M-5 9 Q0 26 5 9 Z', fill(N.lamp, 2)),
    ],
  },
];

const wheel: RigPart[] = [
  {
    id: 'fork',
    parent: 'root',
    pivot: [0, -34],
    z: 1,
    draw: () => [path('M-8 -1 L-5 18 M8 -1 L5 18', line(O, 6))],
  },
  {
    id: 'wheel',
    parent: 'fork',
    pivot: [0, 21],
    z: 2,
    draw: () => [
      circle(0, 0, 13, fill(INK.outline)),
      circle(0, 0, 7, fill(N.bodyLight, 2.5)),
      circle(0, 0, 2.5, { fill: O }),
    ],
  },
];

interface Plan {
  key: 'A' | 'B' | 'C';
  name: string;
  rig: RigPart[];
  /** 浮遊は少し浮かせる */
  lift: number;
}

const PLANS: Plan[] = [
  { key: 'A', name: '旅人（細長い二本脚）', rig: [...upper('legs'), ...longLegs], lift: 0 },
  { key: 'B', name: '浮遊（噴射口）', rig: [...upper('hover'), ...hover], lift: -18 },
  { key: 'C', name: '一輪（車輪）', rig: [...upper('wheel'), ...wheel], lift: 0 },
];

/** 3つのポーズ: 正面（静か）・手を振って光を返す・空（月）を指さす */
const POSES_NUT: Record<'front' | 'wave' | 'point', Pose> = {
  front: {
    angles: { upperArmL: 8, upperArmR: -8, foreArmL: -4, foreArmR: 4 },
    variants: { scarf: 'still' },
  },
  wave: {
    angles: { upperArmL: 8, foreArmL: -4, upperArmR: -150, foreArmR: -20, head: 4 },
    variants: { head: 'lit' },
  },
  point: {
    angles: { upperArmL: 8, foreArmL: -4, upperArmR: -165, foreArmR: 5, head: -6, torso: -3 },
    variants: { head: 'up', handR: 'point' },
  },
};

const shadow = (lift: number) =>
  el('ellipse', { cx: 0, cy: 0, rx: lift ? 14 : 20, ry: 4, fill: INK.black, opacity: 0.25 });

/** ボルトと並べた大きさの比較（ボルトは右に小さく） */
function withBolt(plan: Plan): string[] {
  return [
    shadow(plan.lift),
    group({ transform: `translate(-28 ${plan.lift})` }, ...renderPose(plan.rig, POSES_NUT.front)),
    group({ transform: 'translate(40 -28) scale(0.62)' }, ...composeBolt(POSES.stand!.pose, true)),
  ];
}

export function nutRoughFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const plan of PLANS) {
    for (const [pose, value] of Object.entries(POSES_NUT)) {
      files[`nut-${plan.key}-${pose}.svg`] = svg(
        `ナット（仮名）の体型 ${plan.key}（${plan.name}）: ${pose}（ラフ）`,
        [
          shadow(plan.lift),
          group({ transform: `translate(0 ${plan.lift})` }, ...renderPose(plan.rig, value)),
        ],
        '-60 -192 120 202',
      );
    }
    files[`nut-${plan.key}-withBolt.svg`] = svg(
      `ナット ${plan.key} とボルトの大きさ`,
      withBolt(plan),
      '-80 -192 170 202',
    );
  }
  return files;
}

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../../../docs/characters/roughs');
mkdirSync(out, { recursive: true });
for (const [name, content] of Object.entries(nutRoughFiles()))
  writeFileSync(resolve(out, name), content);
console.log(`wrote ${out}`);
