/**
 * ボルトの体型の3案（段階1のラフ）: A 二本脚・B 一輪・C 浮遊
 *
 * 顔（頭）は既存のアイコンのまま使い、首から下だけを案ごとに変える。上半身（胴・腕・手）は3案で共通。
 * 各案を「正面（待機）」「喜ぶ」「しょんぼり」の3ポーズで描き、docs/characters/roughs/ に書き出す。
 * 実行: pnpm --filter @chain-factory/client exec tsx art/characters/roughs.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOLT_COLORS as C, INK, ROCKET_COLORS as R } from '../../src/assets/palette';
import { boltBody, boltHead, eye } from '../mascot';
import { circle, el, group, line, path, rect, shade, svg } from '../svg';
import { renderPose, type Pose, type RigPart } from './rig';

const O = C.outline;
const W = 3;
const fill = (color: string, width = W) => ({
  fill: color,
  stroke: O,
  'stroke-width': width,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
});

/** 丸い端の棒（腕・脚）: 原点から下へ len */
const limb = (len: number, width: number, color: string) => [
  rect(-width / 2, -width / 2, width, len + width, fill(color), width / 2),
];

// ---- 顔（頭） ----
/** しょんぼり: 目を伏せ（上まぶた）、口はへの字。ランプは暗く */
const SAD_FACE = [
  // 眉は内側が上がる（八の字）。怒り顔（内側が下がる）にしない
  eye(23, 32, 7, 23, 35, 3),
  path('M15 26 Q22 24 29 21', line(O, 3)),
  eye(42, 31, 5, 42, 34, 2),
  path('M37 22 Q42 24 48 25', line(O, 3)),
  path('M25 47 Q32 42 39 47', line(O, 3)),
];

const head = (variant: string | undefined): string[] => {
  const content =
    variant === 'sad'
      ? boltHead(INK.steel, SAD_FACE)
      : boltBody(variant === 'happy' ? 'happy' : 'idle');
  // 頭の絵（viewBox -2 -3 68 68）のあごの中央を首の関節に合わせる
  return [group({ transform: 'translate(-32 -55)' }, ...content)];
};

// ---- 手（開く・握る・指さす） ----
const hand = (variant: string | undefined): string[] => {
  if (variant === 'fist') return [circle(0, 4, 7, fill(INK.steelLight))];
  if (variant === 'point') {
    return [
      rect(-2.5, 4, 5, 14, fill(INK.steelLight, 2.5), 2.5),
      circle(0, 4, 6.5, fill(INK.steelLight)),
    ];
  }
  // 開いた手: ミトン形と、外側の小さな親指
  return [
    circle(-7, 5, 3.5, fill(INK.steelLight, 2.5)),
    path('M-7 2 a7 7 0 0 1 14 0 v6 a7 7 0 0 1 -14 0 Z', fill(INK.steelLight)),
  ];
};

// ---- 上半身（3案共通）: 腰が原点。胴の上が首 ----
const TORSO_H = 34;
const upperBody = (torsoShape: () => string[]): RigPart[] => [
  { id: 'torso', parent: 'root', pivot: [0, 0], z: 2, draw: torsoShape },
  { id: 'head', parent: 'torso', pivot: [0, -TORSO_H - 2], z: 5, draw: head },
  // 腕（左右）: 肩 → 上腕 → 前腕 → 手。奥の腕は z を下げる
  ...(['L', 'R'] as const).flatMap((side): RigPart[] => {
    const x = side === 'L' ? -19 : 19;
    return [
      {
        id: `upperArm${side}`,
        parent: 'torso',
        pivot: [x, -TORSO_H + 6],
        z: 3,
        draw: () => limb(14, 10, INK.steel),
      },
      {
        id: `foreArm${side}`,
        parent: `upperArm${side}`,
        pivot: [0, 14],
        z: 3,
        draw: () => limb(12, 9, INK.steel),
      },
      { id: `hand${side}`, parent: `foreArm${side}`, pivot: [0, 13], z: 4, draw: hand },
    ];
  }),
];

/** 胴: 角を丸めた箱。胸に小さなメーター（ノルマ・出荷の針）。首の短い軸 */
const torsoBox = (bottomWidth = 34): string[] => [
  rect(-5, -TORSO_H - 6, 10, 8, fill(INK.steelDark), 2),
  path(
    `M-20 ${-TORSO_H} H20 L${bottomWidth / 2} -2 Q${bottomWidth / 2} 2 ${bottomWidth / 2 - 4} 2 H${-bottomWidth / 2 + 4} Q${-bottomWidth / 2} 2 ${-bottomWidth / 2} -2 Z`,
    fill(C.body),
  ),
  path(`M-18 -10 H18 L${bottomWidth / 2 - 1} -1 H${-bottomWidth / 2 + 1} Z`, {
    fill: shade(C.body),
  }),
  // 胸のメーター
  circle(0, -21, 7, fill(INK.white, 2)),
  path('M0 -21 L4 -25', line(UI_RED, 2)),
  path('M-14 -30 H-8', line(C.bodyLight, 2.5)),
];
const UI_RED = R.accent;

// ---- 案 A: 二本脚 ----
const legs: RigPart[] = (['L', 'R'] as const).flatMap((side): RigPart[] => {
  const x = side === 'L' ? -9 : 9;
  return [
    {
      id: `thigh${side}`,
      parent: 'root',
      pivot: [x, 0],
      z: 1,
      draw: () => limb(9, 10, INK.steelDark),
    },
    {
      id: `shin${side}`,
      parent: `thigh${side}`,
      pivot: [0, 9],
      z: 1,
      draw: () => limb(8, 9, INK.steel),
    },
    {
      id: `foot${side}`,
      parent: `shin${side}`,
      pivot: [0, 10],
      z: 1,
      // 長靴のような足（つま先を外へ）
      draw: () => [
        path(
          `M-7 0 H${side === 'L' ? -10 : 10} Q${side === 'L' ? -12 : 12} 6 ${side === 'L' ? -8 : 8} 7 H${side === 'L' ? 7 : -7} Z`,
          fill(R.accent),
        ),
      ],
    },
  ];
});

// ---- 案 B: 一輪 ----
const wheel: RigPart[] = [
  {
    id: 'fork',
    parent: 'root',
    pivot: [0, 0],
    z: 1,
    draw: () => [
      path('M-10 -2 L-6 18 M10 -2 L6 18', line(O, 7)),
      path('M-10 -2 L-6 18 M10 -2 L6 18', line(INK.steelDark, 3.5)),
    ],
  },
  {
    id: 'wheel',
    parent: 'fork',
    pivot: [0, 18],
    z: 2,
    draw: () => [
      circle(0, 0, 15, fill(INK.outline)),
      circle(0, 0, 9, fill(INK.steel, 2.5)),
      // 溝（回転がわかる印）
      path('M0 -15 V-10 M0 10 V15 M-15 0 H-10 M10 0 H15', line(INK.steelDark, 2.5)),
      circle(0, 0, 3, { fill: O }),
    ],
  },
];

// ---- 案 C: 浮遊 ----
const hover: RigPart[] = [
  {
    id: 'nozzle',
    parent: 'root',
    pivot: [0, 0],
    z: 1,
    draw: () => [
      path('M-11 0 H11 L8 10 H-8 Z', fill(INK.steelDark)),
      rect(-9, 10, 18, 4, fill(INK.steel, 2.5), 1),
    ],
  },
  {
    id: 'flame',
    parent: 'nozzle',
    pivot: [0, 14],
    z: 0,
    draw: () => [
      path('M-7 0 Q0 22 7 0 Z', fill(R.flame, 2.5)),
      path('M-3 0 Q0 10 3 0 Z', { fill: R.flameCore }),
    ],
  },
];

/** 地面の影（浮遊は地面から離れて小さく） */
const groundShadow = (y: number, rx: number) =>
  el('ellipse', { cx: 0, cy: y, rx, ry: 4, fill: INK.black, opacity: 0.25 });

interface Plan {
  key: 'A' | 'B' | 'C';
  name: string;
  rig: RigPart[];
  /** 足もと（地面）の y */
  ground: number;
  poses: Record<'front' | 'happy' | 'sad', Pose>;
  shadow: (pose: 'front' | 'happy' | 'sad') => string;
}

const armsDown = { upperArmL: 10, upperArmR: -10, foreArmL: -6, foreArmR: 6 };

const root = (rig: RigPart[]): RigPart[] => [
  { id: 'root', parent: null, pivot: [0, 0], z: 0, draw: () => [] },
  ...rig,
];

const PLANS: Plan[] = [
  {
    key: 'A',
    name: '二本脚の小型ロボ',
    rig: root([...upperBody(() => torsoBox()), ...legs]),
    ground: 34,
    poses: {
      front: { angles: armsDown },
      // 喜ぶ: 跳び上がって両腕を上げ、拳を握る（脚は曲げる）
      happy: {
        offsets: { root: [0, -14] },
        angles: {
          upperArmL: 150,
          upperArmR: -150,
          foreArmL: -25,
          foreArmR: 25,
          thighL: 25,
          thighR: -25,
          shinL: -45,
          shinR: 45,
        },
        variants: { head: 'happy', handL: 'fist', handR: 'fist' },
      },
      // しょんぼり: 頭が下がり、肩を落として腕は前でだらり。膝が少し曲がる
      sad: {
        offsets: { root: [0, 3], head: [0, 5] },
        angles: {
          torso: 0,
          head: 6,
          upperArmL: -8,
          upperArmR: 8,
          foreArmL: 18,
          foreArmR: -18,
          thighL: -8,
          thighR: 8,
          shinL: 14,
          shinR: -14,
        },
        variants: { head: 'sad' },
      },
    },
    shadow: (p) => groundShadow(34, p === 'happy' ? 16 : 22),
  },
  {
    key: 'B',
    name: '一輪のロボ',
    rig: root([...upperBody(() => torsoBox(26)), ...wheel]),
    ground: 33,
    poses: {
      front: { angles: armsDown },
      // 喜ぶ: 体を反らして片輪で跳ね、両腕を上げる
      happy: {
        offsets: { root: [0, -10] },
        angles: { torso: -10, upperArmL: 150, upperArmR: -150, foreArmL: -25, foreArmR: 25 },
        variants: { head: 'happy', handL: 'fist', handR: 'fist' },
      },
      // しょんぼり: 体を前に倒し（車輪は止まる）、腕を垂らす
      sad: {
        offsets: { head: [0, 5] },
        angles: { torso: 14, head: 8, upperArmL: -14, upperArmR: -2, foreArmL: 10, foreArmR: -4 },
        variants: { head: 'sad' },
      },
    },
    shadow: () => groundShadow(33, 18),
  },
  {
    key: 'C',
    name: '浮遊する小型ロボ',
    rig: root([...upperBody(() => torsoBox(24)), ...hover]),
    ground: 46,
    poses: {
      front: { angles: armsDown },
      // 喜ぶ: 高く浮き上がり、炎が大きくなる。両腕を上げる
      happy: {
        offsets: { root: [0, -14] },
        angles: { upperArmL: 150, upperArmR: -150, foreArmL: -25, foreArmR: 25 },
        variants: { head: 'happy', handL: 'fist', handR: 'fist' },
      },
      // しょんぼり: 地面すれすれまで沈み、少し傾く。腕を垂らす
      sad: {
        offsets: { root: [0, 10], head: [0, 5] },
        angles: { root: 6, head: 6, upperArmL: -6, upperArmR: 6, foreArmL: 16, foreArmR: -16 },
        variants: { head: 'sad' },
      },
    },
    shadow: (p) => groundShadow(46, p === 'happy' ? 10 : p === 'sad' ? 18 : 14),
  },
];

const VIEW_BOX = '-60 -112 120 164';

export function roughFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const plan of PLANS) {
    for (const pose of ['front', 'happy', 'sad'] as const) {
      files[`${plan.key}-${pose}.svg`] = svg(
        `ボルトの体型 ${plan.key}（${plan.name}）: ${pose}（段階1のラフ）`,
        [plan.shadow(pose), ...renderPose(plan.rig, plan.poses[pose])],
        VIEW_BOX,
      );
    }
  }
  return files;
}

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../../../docs/characters/roughs');
mkdirSync(out, { recursive: true });
for (const [name, content] of Object.entries(roughFiles()))
  writeFileSync(resolve(out, name), content);
console.log(`wrote ${out}`);
