/**
 * ボルトの全身（設定画）: 体型 A「二本脚の小型ロボ」（docs/characters/preview.html）
 *
 * - 顔（頭）は既存のアイコン（art/mascot.ts）のまま。首から下を足す。約 2.3 頭身
 * - 切り絵アニメ用に部品へ分け、関節（回転の中心）とポーズをデータで持つ（art/characters/rig.ts）
 * - 向き（正面・斜め・横・背面）と表情・手の形・小物は、部品の差し替え（variant）で表す
 *
 * 書き出し（pnpm art）:
 * - src/assets/characters/bolt/parts/<部品>-<差し替え>.svg: 部品1つずつ（関節が原点）
 * - src/assets/characters/bolt/rig.json: 部品・関節・重なり順・差し替えの一覧と、ポーズ集のデータ
 * - src/assets/characters/bolt/<views|expressions|poses>/*.svg: 組み上げた絵（設定画・プレビュー用）
 */
import {
  BOLT_COLORS as C,
  INK,
  MATERIAL_COLORS as M,
  ROCKET_COLORS as R,
  UI_COLORS as U,
} from '../../src/assets/palette';
import { boltBody, boltHead, eye } from '../mascot';
import { circle, el, group, line, path, polygon, rect, shade, svg } from '../svg';
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

// =============================================================================
// 寸法（頭の高さ ≒ 55 を1頭身とする）
// =============================================================================
/** 胴の高さ（腰 → 首の付け根） */
export const TORSO_H = 34;
/** 腰から足の裏まで（太もも 8 + すね 7 + 足 6 + 関節の余白） */
export const LEG_H = 28;
/** 立ったときの地面の y（腰が原点） */
export const GROUND_Y = LEG_H;

// =============================================================================
// 表情（頭の差し替え）
// =============================================================================
export const EXPRESSIONS = [
  'idle',
  'happy',
  'surprised',
  'fail',
  'sad',
  'determined',
  'tired',
  'sparkle',
  'sleepy',
  'lookUp',
] as const;
export type Expression = (typeof EXPRESSIONS)[number];

/** 既存の表情（アイコンと同じ絵） */
const ICON_EXPRESSIONS = ['idle', 'happy', 'surprised', 'fail'] as const;

/** 追加の表情: ランプの色・顔・頭の外の飾り */
const EXTRA_FACES: Record<
  Exclude<Expression, (typeof ICON_EXPRESSIONS)[number]>,
  { lamp: string; face: string[]; extras?: string[] }
> = {
  // しょんぼり: 目を伏せ、眉は内側が上がる（八の字）。口はへの字。ランプは消える
  sad: {
    lamp: INK.steel,
    face: [
      eye(23, 32, 7, 23, 35, 3),
      path('M15 26 Q22 24 29 21', line(O, 3)),
      eye(42, 31, 5, 42, 34, 2),
      path('M37 22 Q42 24 48 25', line(O, 3)),
      path('M25 47 Q32 42 39 47', line(O, 3)),
    ],
  },
  // 決意: 眉は内側が下がり、口は一文字。ランプは強く光る
  determined: {
    lamp: C.lamp,
    extras: [path('M27 3 L29 5 M39 3 L37 5', line(C.lamp, 1.8))],
    face: [
      eye(23, 31, 7, 24, 31, 3.5),
      path('M15 21 L30 25', line(O, 3.5)),
      eye(42, 30, 5, 41, 30, 2.2),
      path('M36 25 L49 21', line(O, 3.5)),
      path('M25 45 H40', line(O, 3.5)),
    ],
  },
  // 疲れた笑顔: まぶたが半分下がり、口は小さく笑う。汗
  tired: {
    lamp: C.lamp,
    face: [
      eye(23, 31, 7, 23, 33, 3),
      path('M15.5 28 H30.5', line(O, 3)),
      eye(42, 30, 5, 42, 32, 2),
      path('M37 28 H47', line(O, 3)),
      path('M26 44 Q32 48 38 44', line(O, 3)),
      path('M52 17 q3 4 0 6 q-3 -2 0 -6 Z', { fill: C.sweat, stroke: O, 'stroke-width': 1.5 }),
    ],
  },
  // 目を輝かせる: 大きな目に星のハイライト、口を開けて笑う。ランプのまわりにきらめき
  sparkle: {
    lamp: C.lamp,
    extras: [path('M26 2 L29 5 M40 2 L37 5 M33 -4 V-1', line(C.lamp, 2))],
    face: [
      eye(23, 30, 9, 23, 30, 4.5),
      polygon('21,26 22,29 25,29 23,31 24,34 21,32 18,34 19,31 17,29 20,29', { fill: INK.white }),
      eye(42, 29, 7, 42, 29, 3.5),
      circle(43.5, 27.5, 1.6, { fill: INK.white }),
      path('M24 42 Q32 51 40 42 Z', fill(U['primary-shadow'], 2.5)),
      circle(15, 40, 2.5, { fill: C.cheek, opacity: 0.6 }),
      circle(49, 39, 2.5, { fill: C.cheek, opacity: 0.6 }),
    ],
  },
  // 眠い: 目を閉じ（下向きの弧）、口は小さく開く。ランプは暗い
  sleepy: {
    lamp: INK.steelDark,
    face: [
      path('M17 31 Q23 35 29 31', line(O, 3)),
      path('M38 30 Q42 33 46 30', line(O, 3)),
      el('ellipse', {
        cx: 32,
        cy: 45,
        rx: 3,
        ry: 2.5,
        fill: U['primary-shadow'],
        stroke: O,
        'stroke-width': 2,
      }),
    ],
  },
  // 見上げる: 黒目が上に寄り、口を少し開ける（星・ロケットを見る）
  lookUp: {
    lamp: C.lamp,
    face: [
      eye(23, 30, 8, 24, 25, 3.5),
      eye(42, 29, 5, 42, 26, 2),
      el('ellipse', {
        cx: 32,
        cy: 45,
        rx: 3.5,
        ry: 3,
        fill: U['primary-shadow'],
        stroke: O,
        'stroke-width': 2,
      }),
    ],
  },
};

/** 正面の頭（表情つき）。頭の絵（viewBox -2 -3 68 68）のあごの中央を首の関節に合わせる */
function frontHead(expression: Expression, faceShift = 0): string[] {
  if ((ICON_EXPRESSIONS as readonly string[]).includes(expression) && faceShift === 0) {
    return boltBody(expression as (typeof ICON_EXPRESSIONS)[number]);
  }
  if ((ICON_EXPRESSIONS as readonly string[]).includes(expression)) {
    // 斜め: 既存の表情は、顔をずらすために待機の顔で描く
    return boltHead(C.lamp, [group({ transform: `translate(${faceShift} 0)` }, ...ICON_FACE_IDLE)]);
  }
  const extra = EXTRA_FACES[expression as keyof typeof EXTRA_FACES];
  return boltHead(
    extra.lamp,
    [group({ transform: `translate(${faceShift} 0)` }, ...extra.face)],
    extra.extras,
  );
}

/** 斜めの頭で使う待機の顔（art/mascot.ts の idle と同じ形） */
const ICON_FACE_IDLE = [
  eye(23, 30, 8, 25, 31, 3.5),
  eye(42, 29, 5, 41, 28, 2),
  path('M20 45 L25 41 L30 45 L35 41 L40 45 L44 42', line(O, 2.5)),
];

/** 横顔: 奥行きの浅い箱。前の縁に目と口、側面に耳のボルト、アンテナ */
const sideHead = (): string[] => [
  path('M2 -51 V-58', line(O, 3)),
  circle(2, -59.5, 4, fill(C.lamp, 2.5)),
  rect(-14, -46, 32, 45, fill(C.body, 3.5), 10),
  path('M-12 -14 H16 V-11 a9 9 0 0 1 -9 9 H-3 a9 9 0 0 1 -9 -9 Z', { fill: shade(C.body) }),
  // 耳（側面のボルト）
  rect(-6, -32, 12, 14, fill(C.bodyLight, 2.5), 3),
  circle(0, -25, 2.5, { fill: O }),
  // 目（前の縁から少し出る）と口
  path('M14 -36 a6 7 0 0 1 0 14', fill(INK.white, 2.5)),
  circle(16, -29, 2.2, { fill: C.pupil }),
  path('M13 -12 L18 -14', line(O, 2.5)),
];

/** 背面: 顔のない板。点検口とネジ・排気のすき間 */
const backHead = (): string[] => [
  path('M1 -45 V-52', line(O, 3)),
  circle(1, -53.5, 4, fill(C.lamp, 2.5)),
  rect(-29, -30, 7, 14, fill(C.bodyLight, 2.5), 2),
  rect(22, -30, 7, 14, fill(C.bodyLight, 2.5), 2),
  rect(-24, -45, 48, 45, fill(C.body, 3.5), 11),
  path('M-22 -13 H22 V-10 a9 9 0 0 1 -9 9 H-13 a9 9 0 0 1 -9 -9 Z', { fill: shade(C.body) }),
  rect(-12, -38, 24, 16, fill(shade(C.body), 2.5), 3),
  circle(-9, -35, 1.5, { fill: O }),
  circle(9, -35, 1.5, { fill: O }),
  path('M-8 -10 H8 M-8 -6 H8', line(O, 2)),
];

/**
 * 頭の差し替え: '<表情>'（正面）・'q:<表情>'（斜め）・'side'・'back'
 */
export function headPart(variant: string | undefined): string[] {
  const v = variant ?? 'idle';
  if (v === 'side') return sideHead();
  if (v === 'back') return backHead();
  if (v.startsWith('q:')) {
    // 斜め（3/4）: 頭を少し細くし、顔を右へ寄せる
    const expression = v.slice(2) as Expression;
    return [group({ transform: 'translate(-28 -55) scale(0.88 1)' }, ...frontHead(expression, 5))];
  }
  return [group({ transform: 'translate(-32 -55)' }, ...frontHead(v as Expression))];
}

// =============================================================================
// 胴（正面・斜め・横・背面）
// =============================================================================
/** 胸のメーター（ノルマの針）: ボルトの体の目印 */
const meter = (cx: number, cy: number, r: number) => [
  circle(cx, cy, r, fill(INK.white, 2)),
  path(`M${cx} ${cy} L${cx + r * 0.6} ${cy - r * 0.6}`, line(R.accent, 2)),
  circle(cx, cy, 1.3, { fill: O }),
];

export function torsoPart(variant: string | undefined): string[] {
  const neck = rect(-5, -TORSO_H - 6, 10, 8, fill(INK.steelDark), 2);
  switch (variant) {
    case 'side':
      return [
        neck,
        path(`M-11 ${-TORSO_H} H11 L10 -2 Q10 2 6 2 H-6 Q-10 2 -10 -2 Z`, fill(C.body)),
        path('M-10 -10 H10 L9.5 -1 H-9.5 Z', { fill: shade(C.body) }),
        // 胸のメーターの縁（横から見える厚み）
        rect(8, -27, 5, 12, fill(INK.white, 2), 2),
        path(`M-8 ${-TORSO_H + 4} V-14`, line(C.bodyLight, 2.5)),
      ];
    case 'back':
      return [
        neck,
        path(`M-20 ${-TORSO_H} H20 L17 -2 Q17 2 13 2 H-13 Q-17 2 -17 -2 Z`, fill(C.body)),
        path('M-18 -10 H18 L16 -1 H-16 Z', { fill: shade(C.body) }),
        // 背中の電池のふた
        rect(-9, -28, 18, 14, fill(shade(C.body), 2.5), 2),
        path('M-4 -21 H4 M0 -25 V-17', line(C.lamp, 2)),
      ];
    case 'q':
      return [
        neck,
        path(`M-17 ${-TORSO_H} H19 L16 -2 Q16 2 12 2 H-11 Q-15 2 -15 -2 Z`, fill(C.body)),
        path('M-16 -10 H17 L15 -1 H-14 Z', { fill: shade(C.body) }),
        ...meter(5, -21, 6.5),
        path('M-12 -30 H-7', line(C.bodyLight, 2.5)),
      ];
    default:
      return [
        neck,
        path(`M-20 ${-TORSO_H} H20 L17 -2 Q17 2 13 2 H-13 Q-17 2 -17 -2 Z`, fill(C.body)),
        path('M-18 -10 H18 L16 -1 H-16 Z', { fill: shade(C.body) }),
        ...meter(0, -21, 7),
        path('M-14 -30 H-8', line(C.bodyLight, 2.5)),
      ];
  }
}

// =============================================================================
// 手（開く・握る・指さす・持つ）
// =============================================================================
export const HAND_SHAPES = ['open', 'fist', 'point', 'grip'] as const;

export function handPart(variant: string | undefined): string[] {
  const light = INK.steelLight;
  switch (variant) {
    case 'fist':
      return [circle(0, 5, 7.5, fill(light)), path('M-4 3 H4', line(O, 2))];
    case 'point':
      return [rect(-2.5, 5, 5, 14, fill(light, 2.5), 2.5), circle(0, 5, 6.5, fill(light))];
    case 'grip':
      // 持つ: 指を曲げたミトン（小物の縁をはさむ）
      return [path('M-7 0 a7 7 0 0 1 14 0 v8 h-14 Z', fill(light)), path('M-7 8 h14', line(O, 3))];
    default:
      return [
        circle(-7, 5, 3.5, fill(light, 2.5)),
        path('M-7 2 a7 7 0 0 1 14 0 v6 a7 7 0 0 1 -14 0 Z', fill(light)),
      ];
  }
}

// =============================================================================
// 足（長靴。正面・横・背面）
// =============================================================================
const footPart =
  (side: 'L' | 'R') =>
  (variant: string | undefined): string[] => {
    if (variant === 'side') return [path('M-6 -1 H6 Q14 0 14 6 H-6 Z', fill(R.accent))];
    const out = side === 'L' ? -1 : 1;
    return [
      path(
        `M${-7 * out} -1 H${8 * out} Q${12 * out} 1 ${11 * out} 7 H${-7 * out} Z`,
        fill(R.accent),
      ),
      path(`M${-5 * out} 4 H${8 * out}`, line(R.accentShade, 2)),
    ];
  };

// =============================================================================
// 小物と効果の線（ポーズの意味を補う。台詞は使わない）
// =============================================================================
/** ロケットの部品（重い）: 胴体の輪切り */
const crate = (): string[] => [
  rect(-22, -16, 44, 22, fill(R.body), 4),
  rect(-22, -6, 44, 6, fill(R.accent), 0),
  rect(-22, -16, 44, 22, { fill: 'none', stroke: INK.outline, 'stroke-width': 3 }, 4),
  circle(-14, -11, 1.8, { fill: O }),
  circle(14, -11, 1.8, { fill: O }),
];

/** 設計図: 青い紙にロケットの線画 */
const blueprint = (): string[] => [
  rect(-26, -20, 52, 34, fill(R.window, 2.5), 2),
  path('M0 -15 Q8 -6 7 6 H-7 Q-8 -6 0 -15 Z', line(INK.steelDark, 2)),
  path('M-7 2 L-12 9 M7 2 L12 9 M-18 -14 H-10 M-18 -10 H-12', line(INK.steelDark, 1.6)),
  path('M-26 10 h52', line(O, 1.5)),
];

/** 屋根の縁（座って星を見る） */
const roof = (): string[] => [
  rect(-40, 0, 80, 10, fill(INK.steelDark), 1),
  path('M-36 4 H36', line(INK.steel, 2)),
];

export function propPart(variant: string | undefined): string[] {
  switch (variant) {
    case 'crate':
      return crate();
    case 'blueprint':
      return blueprint();
    case 'roof':
      return roof();
    default:
      return [];
  }
}

/** 効果の線（頭の上・まわり）: うなずく・首を振る・汗・眠い・手を振る */
export function fxPart(variant: string | undefined): string[] {
  const ink = line(INK.white, 2.5);
  switch (variant) {
    case 'nod':
      // 上下の小さな弧（縦に動いた跡）
      return [
        path('M-36 -40 q-4 6 0 12 M36 -40 q4 6 0 12', ink),
        path('M-41 -36 q-3 4 0 8 M41 -36 q3 4 0 8', ink),
      ];
    case 'shake':
      // 左右の弧（横に動いた跡）
      return [
        path('M-38 -52 q-8 14 0 28 M38 -52 q8 14 0 28', ink),
        path('M-45 -46 q-5 8 0 16 M45 -46 q5 8 0 16', ink),
      ];
    case 'sweat':
      return [
        path('M30 -56 q4 5 0 8 q-4 -3 0 -8 Z', fill(C.sweat, 1.5)),
        path('M-34 -48 q3 4 0 6 q-3 -2 0 -6 Z', fill(C.sweat, 1.5)),
      ];
    case 'zzz':
      return [path('M22 -72 h8 l-8 8 h8 M34 -84 h6 l-6 6 h6', line(INK.white, 2.2))];
    case 'stars':
      return [
        polygon(
          '30,-80 32,-75 37,-75 33,-72 35,-67 30,-70 25,-67 27,-72 23,-75 28,-75',
          fill(M.sun, 1.5),
        ),
        polygon(
          '-34,-70 -33,-67 -30,-67 -32,-65 -31,-62 -34,-64 -37,-62 -36,-65 -38,-67 -35,-67',
          fill(M.sun, 1.5),
        ),
      ];
    default:
      return [];
  }
}

// =============================================================================
// 部品の組み立て（関節・重なり順）
// =============================================================================
/** 部品ごとの書き出しの範囲（関節が原点の座標） */
export const PART_BOX: Record<string, [number, number, number, number]> = {
  head: [-48, -90, 96, 96],
  torso: [-24, -44, 48, 50],
  upperArm: [-9, -9, 18, 32],
  foreArm: [-8, -8, 16, 28],
  hand: [-14, -6, 28, 30],
  thigh: [-9, -9, 18, 26],
  shin: [-8, -8, 16, 24],
  foot: [-16, -4, 32, 14],
  prop: [-44, -24, 88, 40],
  fx: [-50, -90, 100, 70],
};

export const BOLT_RIG: RigPart[] = [
  { id: 'root', parent: null, pivot: [0, 0], z: 0, draw: () => [] },
  { id: 'prop', parent: 'root', pivot: [0, 0], z: 0, draw: propPart },
  { id: 'torso', parent: 'root', pivot: [0, 0], z: 3, draw: torsoPart },
  { id: 'head', parent: 'torso', pivot: [0, -TORSO_H - 2], z: 6, draw: headPart },
  { id: 'fx', parent: 'head', pivot: [0, 0], z: 9, draw: fxPart },
  ...(['L', 'R'] as const).flatMap((side): RigPart[] => {
    const sx = side === 'L' ? -1 : 1;
    return [
      {
        id: `thigh${side}`,
        parent: 'root',
        pivot: [9 * sx, 0],
        z: 1,
        draw: () => limb(8, 12, INK.steelDark),
      },
      {
        id: `shin${side}`,
        parent: `thigh${side}`,
        pivot: [0, 8],
        z: 1,
        draw: () => limb(7, 11, INK.steel),
      },
      { id: `foot${side}`, parent: `shin${side}`, pivot: [0, 10], z: 2, draw: footPart(side) },
      {
        id: `upperArm${side}`,
        parent: 'torso',
        pivot: [19 * sx, -TORSO_H + 6],
        z: 4,
        draw: () => limb(14, 10, INK.steel),
      },
      {
        id: `foreArm${side}`,
        parent: `upperArm${side}`,
        pivot: [0, 14],
        z: 4,
        draw: () => limb(12, 9, INK.steel),
      },
      { id: `hand${side}`, parent: `foreArm${side}`, pivot: [0, 13], z: 5, draw: handPart },
    ];
  }),
];

/** 部品の種類（左右の区別を外した名前。PART_BOX のキー） */
export const partKind = (id: string) => id.replace(/[LR]$/, '');

/** 部品ごとに書き出す差し替えの一覧 */
export const PART_VARIANTS: Record<string, readonly string[]> = {
  head: [...EXPRESSIONS, ...EXPRESSIONS.map((e) => `q:${e}`), 'side', 'back'],
  torso: ['front', 'q', 'side', 'back'],
  upperArm: ['default'],
  foreArm: ['default'],
  hand: HAND_SHAPES,
  thigh: ['default'],
  shin: ['default'],
  foot: ['front', 'side'],
  prop: ['crate', 'blueprint', 'roof'],
  fx: ['nod', 'shake', 'sweat', 'zzz', 'stars'],
};

// =============================================================================
// 向き（三面図）とポーズ集
// =============================================================================
const ARMS_DOWN = { upperArmL: 10, upperArmR: -10, foreArmL: -6, foreArmR: 6 };

/** 横向き: 肩・脚の付け根を体の中心へ寄せ、奥の腕・脚を胴の後ろへ回す */
const SIDE: Pose = {
  offsets: { upperArmL: [19, 0], upperArmR: [-19, 0], thighL: [7, 0], thighR: [-7, 0] },
  variants: { head: 'side', torso: 'side', footL: 'side', footR: 'side' },
  z: { upperArmL: 1, foreArmL: 1, handL: 1, thighL: 0, shinL: 0, footL: 0 },
};

/** 背面: 正面の左右をそのまま使い、腕を胴の後ろ（手前）に */
const BACK: Pose = { variants: { head: 'back', torso: 'back' } };

/** 斜め（3/4）: 奥の肩を胴へ寄せる */
const QUARTER: Pose = {
  offsets: { upperArmL: [5, 0], thighL: [2, 0] },
  variants: { head: 'q:idle', torso: 'q' },
  z: { upperArmL: 2, foreArmL: 2, handL: 2 },
};

/** ポーズを重ねる（後の値が勝つ） */
function merge(...poses: Pose[]): Pose {
  const out: Required<Pose> = { angles: {}, offsets: {}, variants: {}, z: {} };
  for (const p of poses) {
    Object.assign(out.angles, p.angles);
    Object.assign(out.offsets, p.offsets);
    Object.assign(out.variants, p.variants);
    Object.assign(out.z, p.z);
  }
  return out;
}

export const VIEWS: Record<'front' | 'quarter' | 'side' | 'back', Pose> = {
  front: { angles: ARMS_DOWN },
  quarter: merge({ angles: ARMS_DOWN }, QUARTER),
  side: merge(SIDE, { angles: { upperArmL: -4, upperArmR: 4 } }),
  back: merge({ angles: ARMS_DOWN }, BACK),
};

/** ポーズ集（ストーリーの身振り）。名前は docs/characters/preview.html の見出しと対応 */
export const POSES: Record<string, { label: string; pose: Pose }> = {
  stand: { label: '立ち', pose: VIEWS.front },
  walk: {
    label: '歩く',
    pose: merge(SIDE, {
      angles: {
        thighL: -28,
        shinL: 10,
        thighR: 26,
        shinR: 24,
        upperArmL: 28,
        upperArmR: -30,
        foreArmR: -20,
      },
      variants: { head: 'side' },
    }),
  },
  jump: {
    label: '跳ねる',
    pose: {
      offsets: { root: [0, -16] },
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
  },
  nod: {
    label: 'うなずく',
    pose: {
      offsets: { head: [0, 7] },
      angles: ARMS_DOWN,
      variants: { head: 'happy', fx: 'nod' },
    },
  },
  shake: {
    label: '首を振る',
    pose: {
      angles: { ...ARMS_DOWN, head: -14 },
      variants: { head: 'sad', fx: 'shake' },
    },
  },
  point: {
    label: '指さす',
    pose: {
      angles: { upperArmL: 10, foreArmL: -6, upperArmR: -100, foreArmR: 0, head: -4, torso: -3 },
      variants: { head: 'determined', handR: 'point' },
    },
  },
  lookUp: {
    label: '見上げる',
    pose: {
      offsets: { head: [0, -2] },
      angles: { ...ARMS_DOWN, torso: -4, head: -3 },
      variants: { head: 'lookUp', fx: 'stars' },
    },
  },
  sad: {
    label: 'しょんぼり',
    pose: {
      offsets: { root: [0, 3], head: [0, 6] },
      angles: {
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
  stagger: {
    label: 'よろける（重い部品）',
    pose: {
      // 重い部品を胸の前で抱え、後ろへ反ってよろける（膝を曲げて脚を開く）
      offsets: { root: [0, 4], prop: [-6, -6] },
      angles: {
        root: -8,
        torso: -6,
        upperArmL: -40,
        foreArmL: -55,
        upperArmR: 30,
        foreArmR: 60,
        thighL: 24,
        shinL: -14,
        thighR: -18,
        shinR: 8,
      },
      variants: { head: 'surprised', handL: 'grip', handR: 'grip', prop: 'crate', fx: 'sweat' },
      z: { prop: 4.5 },
    },
  },
  guts: {
    label: 'ガッツポーズ',
    pose: {
      angles: {
        upperArmR: -150,
        foreArmR: 40,
        upperArmL: 40,
        foreArmL: -70,
        thighL: 6,
        thighR: -6,
      },
      variants: { head: 'determined', handL: 'fist', handR: 'fist' },
    },
  },
  wave: {
    label: '手を振る',
    pose: {
      angles: { upperArmL: 10, foreArmL: -6, upperArmR: -135, foreArmR: -25, head: 4 },
      variants: { head: 'happy', handR: 'open' },
    },
  },
  sitStars: {
    label: '座って星を見る',
    pose: merge(SIDE, {
      // 屋根の縁に腰かけ、脚を前の縁から垂らす（屋根は後ろ側に伸びる）
      offsets: { root: [0, 8], prop: [-34, 3] },
      angles: {
        thighL: -88,
        thighR: -84,
        shinL: 78,
        shinR: 66,
        upperArmL: 40,
        foreArmL: -20,
        upperArmR: 30,
        foreArmR: -20,
        head: -16,
      },
      variants: { head: 'side', prop: 'roof', fx: 'stars' },
      z: { prop: -1 },
    }),
  },
  blueprint: {
    label: '設計図を広げる',
    pose: {
      offsets: { prop: [0, -14] },
      angles: { upperArmL: -35, foreArmL: -50, upperArmR: 35, foreArmR: 50 },
      variants: { head: 'sparkle', handL: 'grip', handR: 'grip', prop: 'blueprint' },
      z: { prop: 4.5 },
    },
  },
};

/** 書き出しの範囲（腰が原点。地面 y = GROUND_Y） */
export const VIEW_BOX = '-70 -122 140 162';

const shadow = (rx = 22) =>
  el('ellipse', { cx: 0, cy: GROUND_Y, rx, ry: 4, fill: INK.black, opacity: 0.25 });

export function composeBolt(pose: Pose, withShadow = true): string[] {
  return [...(withShadow ? [shadow()] : []), ...renderPose(BOLT_RIG, pose)];
}

/** 部品1つの SVG（関節が原点。書き出しの範囲は PART_BOX） */
function partSvg(id: string, variant: string): string {
  const kind = partKind(id);
  const part = BOLT_RIG.find((p) => p.id === id)!;
  const [x, y, w, h] = PART_BOX[kind]!;
  return svg(
    `ボルトの部品: ${id} / ${variant}`,
    part.draw(variant === 'default' ? undefined : variant),
    `${x} ${y} ${w} ${h}`,
  );
}

/** 書き出すファイル名に使える形（q:idle → q-idle） */
export const fileVariant = (v: string) => v.replace(':', '-');

/** rig.json の中身（部品・関節・差し替え・ポーズ。ゲーム内の切り絵アニメが読む） */
export function boltRigJson() {
  return {
    version: 1,
    groundY: GROUND_Y,
    viewBox: VIEW_BOX,
    parts: BOLT_RIG.filter((p) => p.id !== 'root').map((p) => {
      const kind = partKind(p.id);
      const variants = PART_VARIANTS[kind]!;
      return {
        id: p.id,
        parent: p.parent,
        pivot: p.pivot,
        z: p.z,
        box: PART_BOX[kind],
        // 左右で絵が違う部品（足）は id ごとにファイルを分ける
        files: Object.fromEntries(
          variants.map((v) => [v, `parts/${kind === 'foot' ? p.id : kind}-${fileVariant(v)}.svg`]),
        ),
      };
    }),
    poses: Object.fromEntries(Object.entries(POSES).map(([key, { pose }]) => [key, pose])),
    views: VIEWS,
  };
}

export function boltFiles(): Record<string, string> {
  const base = 'src/assets/characters/bolt';
  const files: Record<string, string> = {};
  const written = new Set<string>();
  for (const part of BOLT_RIG) {
    if (part.id === 'root') continue;
    const kind = partKind(part.id);
    const name = kind === 'foot' ? part.id : kind;
    if (written.has(name)) continue;
    written.add(name);
    for (const v of PART_VARIANTS[kind]!) {
      files[`${base}/parts/${name}-${fileVariant(v)}.svg`] = partSvg(part.id, v);
    }
  }
  for (const [key, pose] of Object.entries(VIEWS)) {
    files[`${base}/views/${key}.svg`] = svg(`ボルトの三面図: ${key}`, composeBolt(pose), VIEW_BOX);
  }
  for (const [key, { label, pose }] of Object.entries(POSES)) {
    files[`${base}/poses/${key}.svg`] = svg(
      `ボルトのポーズ: ${label}`,
      composeBolt(pose),
      VIEW_BOX,
    );
  }
  for (const expression of EXPRESSIONS) {
    files[`${base}/expressions/${expression}.svg`] = svg(
      `ボルトの表情: ${expression}`,
      headPart(expression),
      '-36 -62 72 72',
    );
  }
  files[`${base}/rig.json`] = `${JSON.stringify(boltRigJson(), null, 2)}\n`;
  return files;
}
