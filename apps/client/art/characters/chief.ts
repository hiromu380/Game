/**
 * 工場長（天井クレーン）: ノルマと引き換えに、ロケットの部品を渡す役（docs/characters/preview.html）
 *
 * - 柱（マスト）の上の運転席が頭。窓の帯のランプが目で、鉄板のまぶたで機嫌を表す（普段は気難しい）
 * - 腕はジブ（長い腕）、手はフック。フックは重さで常に真下へ下がる（ポーズでジブを回しても、フックの角度で打ち消す）
 * - ヘルメットは別の部品（エンディングで初めて持ち上げて挨拶する）
 * - ボルトより大きく（約 2 倍の高さ）、画面に入ると力関係が伝わる
 *
 * 書き出し（pnpm art）: src/assets/characters/chief/（parts・rig.json・poses）
 */
import {
  FAMILY_COLORS as F,
  INK,
  MATERIAL_COLORS as M,
  ROCKET_COLORS as R,
} from '../../src/assets/palette';
import { circle, line, path, polygon, rect, shade, sizedSvg, svg } from '../svg';
import { renderPose, type Pose, type RigPart } from './rig';

const O = INK.outline;
const fill = (color: string, width = 3) => ({
  fill: color,
  stroke: O,
  'stroke-width': width,
  'stroke-linejoin': 'round',
  'stroke-linecap': 'round',
});
/** 本体の色: 警戒色の黄（工場の機械の色） */
const Y = F.hazard.main;

/** 柱の高さ（台車の上から運転席の下まで） */
export const MAST_H = 104;

// =============================================================================
// 表情（運転席の差し替え）: stern 気難しい・soft 和らぐ・surprised 驚く
// =============================================================================
export const CHIEF_MOODS = ['stern', 'soft', 'surprised'] as const;

function lampEyes(cx: number, cy: number, gap: number, mood: string | undefined): string[] {
  const eyes: string[] = [];
  for (const sx of [-1, 1]) {
    const x = cx + sx * gap;
    if (mood === 'surprised') {
      eyes.push(circle(x, cy, 9, fill(M.sun, 2.5)), circle(x, cy, 2, { fill: O }));
      continue;
    }
    eyes.push(circle(x, cy, 8, fill(M.sun, 2.5)), circle(x, cy + 1, 3, { fill: O }));
    if (mood === 'soft') {
      // 和らぐ: まぶたが上がり、目の下に笑いじわ
      eyes.push(path(`M${x - 7} ${cy + 11} q7 4 14 0`, line(O, 2)));
      continue;
    }
    // 気難しい: 鉄板のまぶたが半分下りる。内側（顔の中央寄り）が低い
    const inner = x - sx * 10;
    const outer = x + sx * 10;
    eyes.push(
      polygon(`${outer},${cy - 12} ${inner},${cy - 12} ${inner},${cy - 1} ${outer},${cy - 7}`, {
        fill: INK.steelDark,
        stroke: O,
        'stroke-width': 2.5,
        'stroke-linejoin': 'round',
      }),
    );
  }
  return eyes;
}

// =============================================================================
// 部品
// =============================================================================
const cab = (mood: string | undefined): string[] => [
  rect(-30, -44, 60, 44, fill(Y), 6),
  rect(-30, -14, 60, 14, { fill: shade(Y) }),
  rect(-30, -44, 60, 44, { fill: 'none', stroke: O, 'stroke-width': 3.5 }, 6),
  // 窓の帯（目のランプが入る）
  rect(-25, -38, 50, 22, fill(INK.steelDark, 2.5), 4),
  ...lampEyes(0, -27, 12, mood),
  // 口: 通気口のスリット（普段はへの字・和らぐと笑う・驚くと丸）
  mood === 'surprised'
    ? circle(0, -7, 3.5, fill(INK.outline, 2))
    : path(mood === 'soft' ? 'M-10 -8 Q0 -3 10 -8' : 'M-10 -6 Q0 -10 10 -6', line(O, 3)),
  // 運転席の横のリベット
  circle(-25, -8, 1.8, { fill: O }),
  circle(25, -8, 1.8, { fill: O }),
];

const truss = (length: number, vertical: boolean) =>
  Array.from({ length: Math.floor(length / 17) }, (_, i) =>
    vertical
      ? path(
          `M-12 ${-i * 17 - 2} L12 ${-i * 17 - 17} M12 ${-i * 17 - 2} L-12 ${-i * 17 - 17}`,
          line(shade(Y), 3),
        )
      : path(`M${i * 15 + 2} 6 L${i * 15 + 15} -6`, line(shade(Y), 3)),
  );

const hook = (variant: string | undefined): string[] => {
  const top = [path('M0 0 V22', line(O, 2.5)), rect(-6, 20, 12, 8, fill(INK.steel, 2.5), 2)];
  if (variant === 'hold') {
    // ロケットの部品（胴体の輪切り）をつかんでいる
    return [
      ...top,
      rect(-17, 30, 34, 20, fill(R.body), 3),
      rect(-17, 39, 34, 5, { fill: R.accent }),
      rect(-17, 30, 34, 20, { fill: 'none', stroke: O, 'stroke-width': 3 }, 3),
    ];
  }
  return [
    ...top,
    path('M0 28 V36 a7 7 0 1 1 -10 6', {
      fill: 'none',
      stroke: O,
      'stroke-width': 5,
      'stroke-linecap': 'round',
    }),
    path('M0 28 V36 a7 7 0 1 1 -10 6', line(INK.steelLight, 2)),
  ];
};

/** 効果の線（運転席のまわり）: うなずく・首を振る・ため息 */
const fx = (variant: string | undefined): string[] => {
  const ink = line(INK.white, 2.5);
  switch (variant) {
    case 'nod':
      return [path('M-40 -36 q-4 6 0 12 M40 -36 q4 6 0 12', ink)];
    case 'shake':
      return [
        path('M-42 -46 q-8 14 0 28 M42 -46 q8 14 0 28 M-50 -40 q-5 8 0 16 M50 -40 q5 8 0 16', ink),
      ];
    case 'steam':
      // 煙を吐く（不機嫌・ため息）
      return [path('M-30 -46 q-6 -6 0 -12 q6 -6 0 -12', line(INK.steelLight, 3))];
    default:
      return [];
  }
};

export const CHIEF_RIG: RigPart[] = [
  { id: 'root', parent: null, pivot: [0, 0], z: 0, draw: () => [] },
  {
    id: 'base',
    parent: 'root',
    pivot: [0, 0],
    z: 1,
    // 台車（レールの上を動く）
    draw: () => [
      rect(-38, -16, 76, 12, fill(INK.steelDark), 3),
      ...[-26, 0, 26].map((x) => circle(x, -4, 6, fill(INK.steel, 2.5))),
      ...[-26, 0, 26].map((x) => circle(x, -4, 1.8, { fill: O })),
    ],
  },
  {
    id: 'mast',
    parent: 'root',
    pivot: [0, -14],
    z: 2,
    draw: () => [
      rect(-12, -MAST_H, 24, MAST_H, fill(Y), 2),
      ...truss(MAST_H, true),
      rect(-12, -MAST_H, 24, MAST_H, { fill: 'none', stroke: O, 'stroke-width': 3 }, 2),
    ],
  },
  { id: 'cab', parent: 'mast', pivot: [0, -MAST_H], z: 4, draw: cab },
  {
    id: 'hat',
    parent: 'cab',
    pivot: [0, -44],
    z: 5,
    // ヘルメット（白・前に小さな工場のマーク）
    draw: () => [
      path('M-26 0 Q-26 -20 0 -20 Q26 -20 26 0 Z', fill(INK.white)),
      rect(-32, -3, 64, 6, fill(INK.white), 3),
      path('M-6 -19 V-3 M6 -19 V-3', line(INK.steelLight, 3)),
      rect(-4, -14, 8, 7, { fill: R.accent }, 1),
    ],
  },
  {
    // 腕（ジブ）: 運転席の横から右へ伸びる
    id: 'jib',
    parent: 'cab',
    pivot: [26, -24],
    z: 3,
    draw: () => [
      rect(0, -7, 78, 14, fill(Y), 2),
      ...truss(78, false),
      rect(0, -7, 78, 14, { fill: 'none', stroke: O, 'stroke-width': 3 }, 2),
      circle(0, 0, 6, fill(INK.steelDark, 2.5)),
    ],
  },
  { id: 'hook', parent: 'jib', pivot: [72, 6], z: 3, draw: hook },
  { id: 'fx', parent: 'cab', pivot: [0, 0], z: 6, draw: fx },
];

export const CHIEF_PART_BOX: Record<string, [number, number, number, number]> = {
  base: [-42, -24, 84, 30],
  mast: [-16, -MAST_H - 4, 32, MAST_H + 8],
  cab: [-34, -48, 68, 52],
  hat: [-36, -24, 72, 30],
  jib: [-8, -10, 90, 20],
  hook: [-20, -4, 40, 58],
  fx: [-58, -62, 116, 50],
};

export const CHIEF_VARIANTS: Record<string, readonly string[]> = {
  base: ['default'],
  mast: ['default'],
  cab: CHIEF_MOODS,
  hat: ['default'],
  jib: ['default'],
  hook: ['open', 'hold'],
  fx: ['nod', 'shake', 'steam'],
};

// =============================================================================
// ポーズ
// =============================================================================
/** フックを真下へ下げる（運転席・ジブの角度を打ち消す） */
function hang(pose: Pose): Pose {
  const a = pose.angles ?? {};
  return { ...pose, angles: { ...a, hook: -((a.mast ?? 0) + (a.cab ?? 0) + (a.jib ?? 0)) } };
}

export const CHIEF_POSES: Record<string, { label: string; pose: Pose }> = {
  neutral: { label: '普段（気難しい）', pose: hang({ variants: { cab: 'stern' } }) },
  point: {
    label: 'ノルマの箱を指さす',
    pose: hang({ angles: { jib: 32, cab: 4 }, variants: { cab: 'stern' } }),
  },
  shake: {
    label: '首を振る',
    pose: hang({ angles: { cab: -12, jib: 8 }, variants: { cab: 'stern', fx: 'shake' } }),
  },
  nod: {
    label: 'うなずく',
    pose: hang({
      offsets: { cab: [0, 6] },
      angles: { cab: 6 },
      variants: { cab: 'stern', fx: 'nod' },
    }),
  },
  offer: {
    label: '部品を差し出す',
    pose: hang({ angles: { jib: 50 }, variants: { cab: 'stern', hook: 'hold' } }),
  },
  // 腕を組む（相当）: ジブを体の前に畳み、フックを上げて「待て」
  fold: {
    label: '腕を組む（ジブを畳む）',
    pose: {
      angles: { jib: 155, hook: -150, cab: 3 },
      variants: { cab: 'stern', fx: 'steam' },
      z: { jib: 5, hook: 5 },
    },
  },
  tip: {
    label: '帽子を上げる（エンディング）',
    pose: hang({
      offsets: { hat: [0, -14] },
      angles: { hat: -12, jib: -20 },
      variants: { cab: 'soft' },
    }),
  },
  surprised: {
    label: '驚く',
    pose: hang({ offsets: { cab: [0, -4] }, angles: { jib: -35 }, variants: { cab: 'surprised' } }),
  },
};

export const CHIEF_VIEW_BOX = '-70 -200 190 210';

export function composeChief(pose: Pose): string[] {
  return [
    `<ellipse cx="0" cy="2" rx="46" ry="5" fill="${INK.black}" opacity="0.25"/>`,
    ...renderPose(CHIEF_RIG, pose),
  ];
}

export function chiefRigJson() {
  return {
    version: 1,
    viewBox: CHIEF_VIEW_BOX,
    parts: CHIEF_RIG.filter((p) => p.id !== 'root').map((p) => ({
      id: p.id,
      parent: p.parent,
      pivot: p.pivot,
      z: p.z,
      box: CHIEF_PART_BOX[p.id],
      files: Object.fromEntries(CHIEF_VARIANTS[p.id]!.map((v) => [v, `parts/${p.id}-${v}.svg`])),
    })),
    poses: Object.fromEntries(Object.entries(CHIEF_POSES).map(([k, { pose }]) => [k, pose])),
  };
}

export function chiefFiles(): Record<string, string> {
  const base = 'src/assets/characters/chief';
  const files: Record<string, string> = {};
  for (const part of CHIEF_RIG) {
    if (part.id === 'root') continue;
    const [x, y, w, h] = CHIEF_PART_BOX[part.id]!;
    for (const v of CHIEF_VARIANTS[part.id]!) {
      files[`${base}/parts/${part.id}-${v}.svg`] = sizedSvg(
        `工場長の部品: ${part.id} / ${v}`,
        part.draw(v === 'default' ? undefined : v),
        `${x} ${y} ${w} ${h}`,
      );
    }
  }
  for (const [key, { label, pose }] of Object.entries(CHIEF_POSES)) {
    files[`${base}/poses/${key}.svg`] = svg(
      `工場長のポーズ: ${label}`,
      composeChief(pose),
      CHIEF_VIEW_BOX,
    );
  }
  for (const mood of CHIEF_MOODS) {
    files[`${base}/expressions/${mood}.svg`] = svg(
      `工場長の表情: ${mood}`,
      cab(mood),
      '-34 -48 68 52',
    );
  }
  files[`${base}/rig.json`] = `${JSON.stringify(chiefRigJson(), null, 2)}\n`;
  return files;
}
