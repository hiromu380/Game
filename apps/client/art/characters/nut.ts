/**
 * 見知らぬロボ「ナット」（仮名）の設定画: 体型 A「旅人」（docs/characters/nut-roughs.html から採用）
 *
 * - エンディングの伏線（遠くの工場のアンテナの光・工場長の古い写真）に出る、ボルトより先に月へ旅立った先輩
 * - 六角ナットの頭・1つ目のレンズ・高いアンテナの水色のランプ・オレンジのマフラー・胸の方位磁針
 * - 約 3 頭身（頭 48・胴 44・脚 35。腰が原点、地面 y = 35）。ボルト（約 2.3 頭身）より背が高く細い
 * - ボルトと同じく、切り絵アニメの部品・関節・ポーズを rig.json に持つ（art/characters/rig.ts）
 *
 * 書き出し（pnpm art）: src/assets/characters/nut/（parts・views・expressions・poses・rig.json）
 */
import { INK, NUT_COLORS as N, ROCKET_COLORS as R } from '../../src/assets/palette';
import { circle, el, line, path, polygon, rect, shade, sizedSvg, svg } from '../svg';
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

/** 地面の y（腰が原点） */
export const NUT_GROUND_Y = 35;

// =============================================================================
// 頭（表情はレンズ・まぶた・アンテナの光で出す）
// =============================================================================
export const NUT_EXPRESSIONS = ['idle', 'happy', 'surprised', 'sad', 'lookUp', 'blink'] as const;
export type NutExpression = (typeof NUT_EXPRESSIONS)[number];

/** アンテナとランプ（lit なら光の輪） */
const antenna = (x: number, lit: boolean) => [
  path(`M${x} -48 V-74`, line(O, 3)),
  ...(lit ? [el('circle', { cx: x, cy: -78, r: 11, fill: N.lamp, opacity: 0.45 })] : []),
  circle(x, -78, 5.5, fill(N.lamp, 2.5)),
];

/** 1つ目のレンズ（表情） */
function lens(cx: number, expression: NutExpression): string[] {
  const ring = [circle(cx, -26, 13, fill(N.lensRing, 3))];
  switch (expression) {
    case 'blink':
      return [
        ...ring,
        circle(cx, -26, 9, { fill: N.lensRing }),
        path(`M${cx - 8} -25 Q${cx} -21 ${cx + 8} -25`, line(N.lens, 3)),
      ];
    case 'happy':
      // にっこり: レンズの中で目が上向きの弧（∩）になる
      return [
        ...ring,
        circle(cx, -26, 9, { fill: N.lensRing }),
        path(`M${cx - 7} -23 Q${cx} -33 ${cx + 7} -23`, line(N.lens, 3.5)),
      ];
    case 'surprised':
      return [...ring, circle(cx, -26, 10.5, { fill: N.lens }), circle(cx, -26, 2.5, { fill: O })];
    case 'sad':
      // 上まぶたが下がる（外側が下がった、さびしげな形）
      return [
        ...ring,
        circle(cx, -26, 9, { fill: N.lens }),
        circle(cx, -23, 4, { fill: O }),
        path(`M${cx - 11} -30 Q${cx} -36 ${cx + 11} -30 L${cx + 11} -38 H${cx - 11} Z`, {
          fill: N.lensRing,
        }),
      ];
    case 'lookUp':
      return [
        ...ring,
        circle(cx, -26, 9, { fill: N.lens }),
        circle(cx, -30, 4.5, { fill: O }),
        circle(cx - 3, -33, 1.6, { fill: INK.white }),
      ];
    default:
      return [
        ...ring,
        circle(cx, -26, 9, { fill: N.lens }),
        circle(cx, -26, 4.5, { fill: O }),
        circle(cx - 3, -29, 1.6, { fill: INK.white }),
      ];
  }
}

const hexFront = () => [
  polygon('-27,-25 -14,-48 14,-48 27,-25 14,-2 -14,-2', fill(N.body, 3.5)),
  polygon('-20,-25 -10,-42 10,-42 20,-25 10,-8 -10,-8', {
    fill: 'none',
    stroke: N.bodyLight,
    'stroke-width': 2,
  }),
  path('M-27 -25 L-14 -2 H14 L27 -25', { fill: shade(N.body), opacity: 0.5 }),
  circle(-21, -12, 1.8, { fill: O }),
  circle(21, -12, 1.8, { fill: O }),
];

/** 頭の差し替え: '<表情>'（正面）・'q:<表情>'（斜め）・'side'・'back' */
export function nutHead(variant: string | undefined): string[] {
  const v = variant ?? 'idle';
  if (v === 'side') {
    // 横: 六角の側面（細い板）。レンズが前に出る
    return [
      ...antenna(0, false),
      rect(-12, -48, 24, 46, fill(N.body, 3.5), 3),
      path('M-10 -40 H10 M-10 -10 H10', line(N.bodyLight, 2)),
      path('M12 -36 h6 a4 4 0 0 1 4 4 v12 a4 4 0 0 1 -4 4 h-6 Z', fill(N.lensRing, 2.5)),
      circle(19, -26, 3.5, { fill: N.lens }),
    ];
  }
  if (v === 'back') {
    return [
      ...antenna(0, false),
      ...hexFront(),
      rect(-10, -34, 20, 14, fill(shade(N.body), 2.5), 2),
      path('M-6 -27 H6', line(O, 2)),
    ];
  }
  if (v.startsWith('q:')) {
    const expression = v.slice(2) as NutExpression;
    return [
      ...antenna(5, expression === 'happy'),
      polygon('-22,-25 -12,-48 15,-48 26,-25 15,-2 -12,-2', fill(N.body, 3.5)),
      path('M-22 -25 L-12 -2 H15 L26 -25', { fill: shade(N.body), opacity: 0.5 }),
      ...lens(6, expression),
    ];
  }
  const expression = v as NutExpression;
  return [
    ...antenna(4, expression === 'happy' || expression === 'lookUp'),
    ...hexFront(),
    ...lens(0, expression),
  ];
}

// =============================================================================
// 胴・マフラー・手・足
// =============================================================================
/** 胸の方位磁針（旅人の記号。ボルトは針のメーター） */
const compass = (cx: number) => [
  circle(cx, -22, 6, fill(INK.white, 2)),
  path(`M${cx} -27 L${cx + 2} -22 L${cx} -17 L${cx - 2} -22 Z`, { fill: R.accent }),
];

export function nutTorso(variant: string | undefined): string[] {
  const neck = rect(-4, -44, 8, 9, fill(INK.steelDark, 2.5), 2);
  switch (variant) {
    case 'side':
      return [
        neck,
        path('M-8 -36 H8 L7 0 H-7 Z', fill(N.body)),
        rect(6, -26, 4, 9, fill(INK.white, 2), 2),
      ];
    case 'back':
      return [
        neck,
        path('M-15 -36 H15 L10 0 H-10 Z', fill(N.body)),
        // 背中の小さな荷物（旅人）
        rect(-11, -32, 22, 20, fill(N.scarfShade, 2.5), 4),
        path('M-11 -24 H11', line(O, 2)),
      ];
    case 'q':
      return [neck, path('M-12 -36 H16 L11 0 H-9 Z', fill(N.body)), ...compass(4)];
    default:
      return [
        neck,
        path('M-15 -36 H15 L10 0 H-10 Z', fill(N.body)),
        path('M-12 -13 H12 L9 -1 H-9 Z', { fill: shade(N.body) }),
        ...compass(0),
      ];
  }
}

/** マフラー: 'still'（垂れる）・'wind'（右へなびく）・'back'（背中へ流れる） */
export function nutScarf(variant: string | undefined): string[] {
  if (variant === 'back') {
    return [
      rect(-17, -6, 34, 9, fill(N.scarf, 2.5), 4),
      path('M-6 2 q-4 14 -14 24 l8 3 q8 -10 12 -26 Z', fill(N.scarf, 2.5)),
    ];
  }
  const w = variant === 'wind' ? 1 : 0;
  return [
    rect(-17, -6, 34, 9, fill(N.scarf, 2.5), 4),
    w
      ? path('M10 1 q22 -2 42 -8 l-3 9 q-12 2 -24 -2 Z', fill(N.scarf, 2.5))
      : path('M8 1 q4 12 2 24 l8 0 q2 -12 -2 -24 Z', fill(N.scarf, 2.5)),
    w
      ? path('M24 0 l3 6 M34 -3 l3 6', line(N.scarfShade, 2))
      : path('M10 14 h6 M10 20 h7', line(N.scarfShade, 2)),
  ];
}

export function nutHand(variant: string | undefined): string[] {
  const light = INK.steelLight;
  if (variant === 'point')
    return [rect(-2.5, 4, 5, 13, fill(light, 2.5), 2.5), circle(0, 4, 6, fill(light))];
  if (variant === 'fist') return [circle(0, 5, 6.5, fill(light)), path('M-3 3 H3', line(O, 2))];
  return [
    circle(-6, 5, 3, fill(light, 2.5)),
    path('M-6 2 a6 6 0 0 1 12 0 v6 a6 6 0 0 1 -12 0 Z', fill(light)),
  ];
}

const nutFoot =
  (side: 'L' | 'R') =>
  (variant: string | undefined): string[] => {
    if (variant === 'side') return [path('M-5 -1 H5 Q12 0 12 5 H-5 Z', fill(N.scarf, 2.5))];
    const out = side === 'L' ? -1 : 1;
    return [
      path(
        `M${-6 * out} -1 H${6 * out} Q${10 * out} 0 ${9 * out} 5 H${-6 * out} Z`,
        fill(N.scarf, 2.5),
      ),
    ];
  };

// =============================================================================
// 部品の組み立て
// =============================================================================
export const NUT_PART_BOX: Record<string, [number, number, number, number]> = {
  head: [-36, -96, 72, 100],
  torso: [-20, -48, 40, 52],
  scarf: [-22, -10, 80, 44],
  upperArm: [-8, -8, 16, 32],
  foreArm: [-7, -7, 14, 28],
  hand: [-12, -5, 24, 26],
  thigh: [-8, -8, 16, 30],
  shin: [-7, -7, 14, 28],
  foot: [-14, -4, 28, 12],
};

export const NUT_RIG: RigPart[] = [
  { id: 'root', parent: null, pivot: [0, 0], z: 0, draw: () => [] },
  { id: 'torso', parent: 'root', pivot: [0, 0], z: 3, draw: nutTorso },
  { id: 'head', parent: 'torso', pivot: [0, -44], z: 6, draw: nutHead },
  { id: 'scarf', parent: 'torso', pivot: [0, -38], z: 7, draw: nutScarf },
  ...(['L', 'R'] as const).flatMap((side): RigPart[] => {
    const sx = side === 'L' ? -1 : 1;
    return [
      {
        id: `thigh${side}`,
        parent: 'root',
        pivot: [7 * sx, 0],
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
      { id: `foot${side}`, parent: `shin${side}`, pivot: [0, 15], z: 2, draw: nutFoot(side) },
      {
        id: `upperArm${side}`,
        parent: 'torso',
        pivot: [15 * sx, -32],
        z: 4,
        draw: () => limb(15, 8, INK.steel),
      },
      {
        id: `foreArm${side}`,
        parent: `upperArm${side}`,
        pivot: [0, 15],
        z: 4,
        draw: () => limb(13, 7, INK.steel),
      },
      { id: `hand${side}`, parent: `foreArm${side}`, pivot: [0, 14], z: 5, draw: nutHand },
    ];
  }),
];

const kindOf = (id: string) => id.replace(/[LR]$/, '');

export const NUT_VARIANTS: Record<string, readonly string[]> = {
  head: [...NUT_EXPRESSIONS, ...NUT_EXPRESSIONS.map((e) => `q:${e}`), 'side', 'back'],
  torso: ['front', 'q', 'side', 'back'],
  scarf: ['still', 'wind', 'back'],
  upperArm: ['default'],
  foreArm: ['default'],
  hand: ['open', 'fist', 'point'],
  thigh: ['default'],
  shin: ['default'],
  foot: ['front', 'side'],
};

// =============================================================================
// 向きとポーズ
// =============================================================================
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

const ARMS_DOWN = { upperArmL: 8, upperArmR: -8, foreArmL: -4, foreArmR: 4 };
const SIDE: Pose = {
  offsets: { upperArmL: [15, 0], upperArmR: [-15, 0], thighL: [5, 0], thighR: [-5, 0] },
  variants: { head: 'side', torso: 'side', footL: 'side', footR: 'side', scarf: 'back' },
  z: { upperArmL: 1, foreArmL: 1, handL: 1, thighL: 0, shinL: 0, footL: 0 },
};

export const NUT_VIEWS: Record<'front' | 'quarter' | 'side' | 'back', Pose> = {
  front: { angles: ARMS_DOWN, variants: { scarf: 'still' } },
  quarter: merge(
    { angles: ARMS_DOWN },
    {
      offsets: { upperArmL: [4, 0], thighL: [2, 0] },
      variants: { head: 'q:idle', torso: 'q', scarf: 'still' },
      z: { upperArmL: 2, foreArmL: 2, handL: 2 },
    },
  ),
  side: merge(SIDE, { angles: { upperArmL: -4, upperArmR: 4 } }),
  back: merge(
    { angles: ARMS_DOWN },
    { variants: { head: 'back', torso: 'back', scarf: 'back' }, z: { scarf: 2 } },
  ),
};

export const NUT_POSES: Record<string, { label: string; pose: Pose }> = {
  stand: { label: '立ち', pose: NUT_VIEWS.front },
  wave: {
    label: '手を振って光を返す',
    pose: {
      angles: { upperArmL: 8, foreArmL: -4, upperArmR: -150, foreArmR: -20, head: 4 },
      variants: { head: 'happy', scarf: 'wind' },
    },
  },
  point: {
    label: '空（月）を指さす',
    pose: {
      angles: { upperArmL: 8, foreArmL: -4, upperArmR: -165, foreArmR: 5, head: -6, torso: -3 },
      variants: { head: 'lookUp', handR: 'point', scarf: 'wind' },
    },
  },
  lookUp: {
    label: '見上げる',
    pose: { angles: { ...ARMS_DOWN, head: -8 }, variants: { head: 'lookUp', scarf: 'wind' } },
  },
  nod: {
    label: 'うなずく',
    pose: {
      offsets: { head: [0, 5] },
      angles: ARMS_DOWN,
      variants: { head: 'blink', scarf: 'still' },
    },
  },
  welcome: {
    // 次回作で、ボルトを迎える身振り（片手を差し出す）
    label: '手を差し出す（迎える）',
    pose: {
      angles: { upperArmL: 8, foreArmL: -4, upperArmR: -60, foreArmR: -30, head: 6 },
      variants: { head: 'happy', handR: 'open', scarf: 'wind' },
    },
  },
  sad: {
    label: 'さびしげ（ひとりで待つ）',
    pose: {
      offsets: { head: [0, 4] },
      angles: { upperArmL: 2, upperArmR: -2, foreArmL: 12, foreArmR: -12, head: 8 },
      variants: { head: 'sad', scarf: 'still' },
    },
  },
  walk: {
    label: '歩く',
    pose: merge(SIDE, {
      angles: { thighL: -24, shinL: 10, thighR: 22, shinR: 20, upperArmL: 24, upperArmR: -26 },
    }),
  },
  walkB: {
    label: '歩く（2コマ目）',
    pose: merge(SIDE, {
      angles: { thighL: 22, shinL: 20, thighR: -24, shinR: 10, upperArmL: -26, upperArmR: 24 },
    }),
  },
};

export const NUT_VIEW_BOX = '-70 -142 140 182';

const shadow = () =>
  el('ellipse', { cx: 0, cy: NUT_GROUND_Y, rx: 18, ry: 4, fill: INK.black, opacity: 0.25 });

export function composeNut(pose: Pose, withShadow = true): string[] {
  return [...(withShadow ? [shadow()] : []), ...renderPose(NUT_RIG, pose)];
}

export function nutRigJson() {
  return {
    version: 1,
    groundY: NUT_GROUND_Y,
    viewBox: NUT_VIEW_BOX,
    parts: NUT_RIG.filter((p) => p.id !== 'root').map((p) => {
      const kind = kindOf(p.id);
      const name = kind === 'foot' ? p.id : kind;
      return {
        id: p.id,
        parent: p.parent,
        pivot: p.pivot,
        z: p.z,
        box: NUT_PART_BOX[kind],
        files: Object.fromEntries(
          NUT_VARIANTS[kind]!.map((v) => [v, `parts/${name}-${v.replace(':', '-')}.svg`]),
        ),
      };
    }),
    poses: Object.fromEntries(Object.entries(NUT_POSES).map(([k, { pose }]) => [k, pose])),
    views: NUT_VIEWS,
  };
}

export function nutFiles(): Record<string, string> {
  const base = 'src/assets/characters/nut';
  const files: Record<string, string> = {};
  const written = new Set<string>();
  for (const part of NUT_RIG) {
    if (part.id === 'root') continue;
    const kind = kindOf(part.id);
    const name = kind === 'foot' ? part.id : kind;
    if (written.has(name)) continue;
    written.add(name);
    const [x, y, w, h] = NUT_PART_BOX[kind]!;
    for (const v of NUT_VARIANTS[kind]!) {
      files[`${base}/parts/${name}-${v.replace(':', '-')}.svg`] = sizedSvg(
        `ナットの部品: ${part.id} / ${v}`,
        part.draw(v === 'default' ? undefined : v),
        `${x} ${y} ${w} ${h}`,
      );
    }
  }
  for (const [key, pose] of Object.entries(NUT_VIEWS)) {
    files[`${base}/views/${key}.svg`] = svg(
      `ナットの三面図: ${key}`,
      composeNut(pose),
      NUT_VIEW_BOX,
    );
  }
  for (const [key, { label, pose }] of Object.entries(NUT_POSES)) {
    files[`${base}/poses/${key}.svg`] = svg(
      `ナットのポーズ: ${label}`,
      composeNut(pose),
      NUT_VIEW_BOX,
    );
  }
  for (const e of NUT_EXPRESSIONS) {
    files[`${base}/expressions/${e}.svg`] = svg(`ナットの表情: ${e}`, nutHead(e), '-36 -96 72 100');
  }
  files[`${base}/rig.json`] = `${JSON.stringify(nutRigJson(), null, 2)}\n`;
  return files;
}
