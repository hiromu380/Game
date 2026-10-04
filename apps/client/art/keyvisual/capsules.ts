/**
 * キービジュアル（構図 A「押した瞬間」）と、Steam のカプセル画像（サイズごとの専用構図）
 *
 * - マスター: Header Capsule（920×430）。盤面から光の連鎖が走り、大きな数字が弾け、手前でボルトが驚いて跳ねる
 * - ほかのサイズは単純な切り抜きにせず、同じ層（art/keyvisual/layers.ts）を大きさごとに組み直す
 * - サイズ・形式・ロゴの有無は build/store/capsules.json（Steam の規定。要確認）。書き出しと検証は build/store/generate.mjs
 *
 * 書き出し（pnpm art）: build/store/svg/<id>.svg
 */
import { BOARD_COLORS as B, SIGNAL_TIERS } from '../../src/assets/palette';
import config from '../../build/store/capsules.json';
import { POSES } from '../characters/bolt';
import { el, svg } from '../svg';
import {
  bigNumber,
  board,
  bolt,
  burst,
  chainLight,
  duskSky,
  factoryRow,
  filters,
  logo,
  pop,
  sparks,
  stars,
  type BoardCell,
} from './layers';

/** 画像の種類（capsules.json の id。テストで一致を確かめる） */
export const CAPSULE_IDS = [
  'header',
  'small',
  'main',
  'vertical',
  'library',
  'hero',
  'background',
  'libraryLogo',
] as const;
export type CapsuleId = (typeof CAPSULE_IDS)[number];

/** 見本の盤面（スイッチ → ギア（×2床）→ 分岐 → 上はコイル・プレス（×3床）・出荷口、下はコイル・ドラム缶・出荷口） */
const CELLS: BoardCell[] = [
  { x: 0, y: 2, part: 'switch', dir: 1 },
  { x: 1, y: 2, part: 'gear', dir: 1, floor: 'double' },
  { x: 2, y: 2, part: 'splitter', dir: 1 },
  { x: 2, y: 1, part: 'coil', dir: 1 },
  { x: 3, y: 1, part: 'press', dir: 1, floor: 'triple' },
  { x: 4, y: 1, part: 'dock', dir: 1 },
  { x: 2, y: 3, part: 'coil', dir: 1 },
  { x: 3, y: 3, part: 'barrel', dir: 1 },
  { x: 4, y: 3, part: 'dock', dir: 1 },
  { x: 1, y: 0, part: 'reflector', dir: 2 },
  { x: 3, y: 4, part: 'chainMeter', dir: 1 },
];

/** 驚いて跳ねるボルト（ポーズ集の「跳ねる」に驚きの顔） */
const SURPRISED_JUMP = {
  ...POSES.jump!.pose,
  variants: { ...POSES.jump!.pose.variants, head: 'surprised' },
};

/** 大きな数字（ゲームと同じ K・M・B の表記） */
const SCORE = '1.2B';

interface BoardLayout {
  x: number;
  y: number;
  cell: number;
}

/** 盤面と、その上を走る連鎖の光・倍率のポップ・放射の光・火花 */
function chainBoard({ x, y, cell }: BoardLayout, withPops = true): string[] {
  const c = (i: number, j: number): [number, number] => [
    x + (i + 0.5) * cell,
    y + (j + 0.5) * cell,
  ];
  const lw = cell * 0.14;
  return [
    // 放射の光は盤面の後ろから、盤面の外まで伸ばす（盤面の上には重ねない: 縮小時にごちゃつくため）
    ...burst(...c(2, 2), cell * 5.6, 12),
    ...board(x, y, 5, cell, CELLS),
    ...chainLight([c(0, 2), c(1, 2), c(2, 2), c(2, 1), c(3, 1), c(4, 1)], lw, 1),
    ...chainLight([c(2, 2), c(2, 3), c(3, 3), c(4, 3)], lw, 3),
    ...sparks(...c(2, 2), cell * 3.2, 14, cell * 0.17),
    ...(withPops
      ? [
          ...pop('×2', c(1, 2)[0], c(1, 2)[1] - cell * 0.75, cell / 62),
          ...pop('×3', c(3, 1)[0], c(3, 1)[1] - cell * 0.75, cell / 62),
        ]
      : []),
  ];
}

/** 背景: 夕暮れの空・星・工場街のシルエット */
function backdrop(w: number, h: number, horizon: number, factoryScale: number): string[] {
  return [
    ...duskSky(w, h, horizon),
    ...stars(w, horizon * 0.85, Math.round((w * h) / 9000)),
    ...factoryRow(h + factoryScale * 20, w, factoryScale),
  ];
}

const doc = (id: CapsuleId, w: number, h: number, body: string[], blur = 1) =>
  svg(`Steam ${id}（キービジュアル A「押した瞬間」）`, [filters(blur), ...body], `0 0 ${w} ${h}`);

/** サイズごとの専用構図 */
const COMPOSE: Record<CapsuleId, (w: number, h: number) => string[]> = {
  // マスター: ロゴ（左上）→ ボルト（左下）→ 盤面と数字（右）
  header: (w, h) => [
    ...backdrop(w, h, 300, 0.9),
    ...chainBoard({ x: 506, y: 120, cell: 56 }),
    ...bigNumber(SCORE, 646, 24, 2.8, SIGNAL_TIERS[1]),
    bolt(SURPRISED_JUMP, 296, 420, 262),
    logo(24, 22, 290),
  ],
  // 大きい枠: 同じ並びで、ボルトと盤面を大きく
  main: (w, h) => [
    ...backdrop(w, h, 490, 1.25),
    ...chainBoard({ x: 676, y: 200, cell: 80 }),
    ...bigNumber(SCORE, 876, 40, 3.9, SIGNAL_TIERS[1]),
    bolt(SURPRISED_JUMP, 380, 690, 430),
    logo(36, 34, 400),
  ],
  // 小さい枠: ロゴを最大に、背景は簡略化（盤面なし）。右に光る数字と光の筋
  small: (w, h) => [
    el('rect', { width: w, height: h, fill: B.background }),
    ...backdrop(w, h, 120, 0.55),
    ...burst(362, 70, 140, 10),
    ...chainLight(
      [
        [250, 150],
        [330, 128],
        [400, 140],
        [470, 118],
      ],
      7,
      1,
    ),
    ...bigNumber(SCORE, 362, 42, 2.15, SIGNAL_TIERS[1]),
    logo(10, 28, 246),
  ],
  // 縦長: ロゴ（上）→ 数字 → 盤面、ボルトは左下で盤面の角に重ねる
  vertical: (w, h) => [
    ...backdrop(w, h, 700, 1.3),
    ...chainBoard({ x: 318, y: 360, cell: 76 }),
    ...bigNumber(SCORE, 470, 222, 3.6, SIGNAL_TIERS[1]),
    bolt(SURPRISED_JUMP, 190, 884, 380),
    logo((w - 440) / 2, 30, 440),
  ],
  // ライブラリの縦長（細い）: 縦長と同じ並びを細身に
  library: (w, h) => [
    ...backdrop(w, h, 720, 1.2),
    ...chainBoard({ x: 186, y: 380, cell: 72 }),
    ...bigNumber(SCORE, 330, 236, 3.1, SIGNAL_TIERS[1]),
    bolt(SURPRISED_JUMP, 150, 886, 350),
    logo((w - 470) / 2, 40, 470),
  ],
  // ライブラリの上部（文字・ロゴなし）: 横に長い工場街。重要な要素（ボルト・盤面）は中央 860×380 に収める
  hero: (w, h) => [
    ...backdrop(w, h, 900, 3),
    ...chainLight(
      [
        [0, 860],
        [700, 800],
        [1300, 840],
        [1760, 700],
      ],
      22,
      2,
    ),
    ...chainLight(
      [
        [2080, 700],
        [2600, 820],
        [3200, 780],
        [3840, 850],
      ],
      22,
      3,
    ),
    ...chainBoard({ x: 1880, y: 448, cell: 66 }, false),
    bolt(SURPRISED_JUMP, 1650, 806, 360),
  ],
  // ストアのページ背景: 控えめ（暗く・低いコントラスト。主役を置かない）
  background: (w, h) => [
    ...backdrop(w, h, 760, 1.8),
    el('rect', { width: w, height: h, fill: B.background, opacity: 0.6 }),
  ],
  // ライブラリのロゴ（背景透過）
  libraryLogo: (w, h) => [logo((w - 1120) / 2, (h - (1120 * 90) / 253) / 2, 1120)],
};

/** ぼかしの倍率（大きな画像ほど強く） */
const BLUR: Partial<Record<CapsuleId, number>> = {
  main: 1.3,
  vertical: 1.3,
  library: 1.2,
  hero: 3,
};

export function capsuleSvg(id: CapsuleId): string {
  const spec = config.capsules.find((c) => c.id === id)!;
  return doc(id, spec.width, spec.height, COMPOSE[id](spec.width, spec.height), BLUR[id] ?? 1);
}

export function capsuleFiles(): Record<string, string> {
  return Object.fromEntries(CAPSULE_IDS.map((id) => [`build/store/svg/${id}.svg`, capsuleSvg(id)]));
}
