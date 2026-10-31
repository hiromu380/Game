/**
 * マスコット「ボルト」（デフォルメの作業ロボ）: 表情4種とアプリアイコン
 *
 * 体（頭・耳・アンテナ・ネジ）は共通で、目・口・アンテナのランプだけを表情ごとに変える（docs/art-style.md「マスコット」）。
 * ポンコツ感: 頭が少し左に傾いている・目の大きさが左右で違う・右下のネジが1本抜けて穴だけ
 */
import { BOLT_COLORS as C, INK, UI_COLORS } from '../src/assets/palette';
import { circle, el, group, line, path, rect, rotate, shade, svg, THIN } from './svg';

export type BoltExpression = 'idle' | 'happy' | 'surprised' | 'fail';

const body = (lamp: string, extras: string[] = []): string[] => [
  // アンテナ（棒 + ランプ）
  path('M33 13 V6', line(C.outline, 3)),
  circle(33, 5.5, 4, { fill: lamp, stroke: C.outline, 'stroke-width': THIN }),
  ...extras,
  // 耳（左右のボルト）
  rect(3, 27, 7, 14, { fill: C.bodyLight, stroke: C.outline, 'stroke-width': THIN }, 2),
  rect(54, 27, 7, 14, { fill: C.bodyLight, stroke: C.outline, 'stroke-width': THIN }, 2),
];

/** 頭（傾ける）の中身: 地・影・ネジ */
const head = (face: string[]): string =>
  group(
    { transform: rotate(-4, 32, 34) },
    rect(8, 12, 48, 45, { fill: C.body, stroke: C.outline, 'stroke-width': 3.5 }, 11),
    // 下側の影（1段）
    path('M10 44 H54 V47 a9 9 0 0 1 -9 9 H19 a9 9 0 0 1 -9 -9 Z', { fill: shade(C.body) }),
    // ハイライト1本
    path('M15 17 H26', line(C.bodyLight, 2.5)),
    // ネジ（左上は健在、右下は抜けて穴だけ）
    circle(14, 19, 2, { fill: C.outline }),
    path('M13 18 L15 20', line(C.bodyLight, 1)),
    circle(50, 50, 2, { fill: 'none', stroke: C.outline, 'stroke-width': 1.5 }),
    ...face,
  );

export const eye = (cx: number, cy: number, r: number, px: number, py: number, pr: number) =>
  circle(cx, cy, r, { fill: C.eye, stroke: C.outline, 'stroke-width': THIN }) +
  circle(px, py, pr, { fill: C.pupil });

const FACES: Record<BoltExpression, { lamp: string; face: string[]; extras?: string[] }> = {
  // 待機: いつもの顔（大きい左目・小さい右目・ギザギザの口）
  idle: {
    lamp: C.lamp,
    face: [
      eye(23, 30, 8, 25, 31, 3.5),
      eye(42, 29, 5, 41, 28, 2),
      path('M20 45 L25 41 L30 45 L35 41 L40 45 L44 42', line(C.outline, THIN)),
    ],
  },
  // 喜び: 目を細めて口を大きく開ける。ランプの周りにきらめき
  happy: {
    // 喜び: 大笑いはしない性格。いつもの目のまま、口を閉じて小さく笑う（ランプがほんのり光る）
    lamp: C.lamp,
    extras: [path('M27 3 L29 5 M39 3 L37 5', line(C.lamp, 1.8))],
    face: [
      eye(23, 30, 8, 24, 29, 3.5),
      eye(42, 29, 5, 42, 28, 2),
      path('M24 43 Q32 49 40 43', line(C.outline, 3)),
      circle(16, 39, 2.5, { fill: C.cheek, opacity: 0.6 }),
      circle(48, 38, 2.5, { fill: C.cheek, opacity: 0.6 }),
    ],
  },

  // 驚き: 両目を見開き、口は O。ランプは赤く点灯し「!」
  surprised: {
    lamp: UI_COLORS.missed,
    extras: [path('M44 2 V8 M44 11 V11.5', line(UI_COLORS.missed, 2.5))],
    face: [
      eye(23, 29, 9, 23, 29, 2.5),
      eye(42, 28, 7, 42, 28, 2),
      el('ellipse', {
        cx: 32,
        cy: 46,
        rx: 5,
        ry: 6,
        fill: UI_COLORS['primary-shadow'],
        stroke: C.outline,
        'stroke-width': THIN,
      }),
    ],
  },
  // 失敗: 目が × と渦、口は波線。ランプは消えて煙が出る。汗
  fail: {
    lamp: INK.steel,
    extras: [path('M36 3 q4 -3 2 -6 q-2 -3 3 -5', line(INK.steelLight, 2.5))],
    face: [
      path('M18 25 L28 35 M28 25 L18 35', line(C.outline, 3)),
      path('M42 29 m-4 0 a4 4 0 1 1 4 4 a2.5 2.5 0 1 1 -2 -2.5', line(C.outline, 2)),
      path('M20 46 q3 -4 6 0 t6 0 t6 0 t6 0', line(C.outline, THIN)),
      path('M51 19 q3 4 0 6 q-3 -2 0 -6 Z', {
        fill: C.sweat,
        stroke: C.outline,
        'stroke-width': 1.5,
      }),
    ],
  },
};

/**
 * 好きな顔でボルトの頭を描く（全身の設定画で、表情を足すときに使う。座標は boltBody と同じ）
 * @param face 目・口など（頭の傾きの中に入る）
 */
export function boltHead(lamp: string, face: string[], extras: string[] = []): string[] {
  return [...body(lamp, extras), head(face)];
}

/** ボルトの絵の中身（viewBox -2 -3 68 68 の座標。実績アイコンなどに流用する） */
export function boltBody(expression: BoltExpression): string[] {
  const { lamp, face, extras } = FACES[expression];
  return [...body(lamp, extras), head(face)];
}

export function boltSvg(expression: BoltExpression): string {
  return svg(`マスコット「ボルト」: ${expression}`, boltBody(expression), '-2 -3 68 68');
}

export function mascotFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (const expression of ['idle', 'happy', 'surprised', 'fail'] as const) {
    files[`src/assets/mascot/bolt-${expression}.svg`] = boltSvg(expression);
  }
  // アプリアイコン（ファビコン・ホーム画面）は待機の顔
  files['public/icon.svg'] = boltSvg('idle');
  return files;
}
