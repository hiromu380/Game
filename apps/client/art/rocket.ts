/**
 * ボルトのロケット（1ランの目的）: 組み上がっていく9段階の絵と、発射の炎・煙
 * 赤白のロケットに、ガラクタの部品（じょうご・ドラム缶・洗濯機の扉・バケツ）を混ぜた手作りの姿（設定: docs/characters/）
 *
 * シフトをクリアするたびに1部品ずつ組み上がる（rocket-0 = 何もない ～ rocket-9 = 完成）。
 * まだの部品は点線の輪郭だけを描き、完成形がどうなるか最初からわかるようにする。
 * 部品の順: 1日目 = ノズル・左右の翼、2日目 = 胴体の下・中・上、3日目 = 窓（ボルトが乗る）・先端・アンテナ
 */
import { BOLT_COLORS as B, INK, ROCKET_COLORS as R } from '../src/assets/palette';
import { circle, group, line, outlined, path, rect, svg, THIN } from './svg';

/** 絵の座標系（縦長。一覧の正方形の枠にも収まるよう、左右に余白を持たせる） */
const VIEW_BOX = '-16 -8 96 104';

/** built: 組み上がったか。empty: 窓の中にボルトがいない（カットシーンで乗り込む前） */
type Piece = (built: boolean, empty?: boolean) => string;

/** 組み上がっていない部品の見た目: 点線の輪郭だけ */
const ghost = { fill: 'none', stroke: R.ghost, 'stroke-width': 2, 'stroke-dasharray': '3 3' };
const look = (built: boolean, fill: string) => (built ? outlined(fill, 3) : ghost);

/** 未完成の部品は点線だけ。完成した部品だけに細部（継ぎ目・テープ）を足す */
const detail = (b: boolean, ...parts: string[]) => (b ? parts.join('') : '');

/**
 * 部品（赤白ロケットに、ガラクタの部品を混ぜた手作りのロケット: docs/characters/roughs-chief-rocket.html）
 * - ノズル = じょうご、胴体の下 = ドラム缶（たがの線）、窓 = 洗濯機の扉（厚い金属の輪）、先端 = 赤いバケツ（縁と取っ手）
 * - 胴体の中ほどにテープの継ぎはぎ、胴体の下に手描きの番号
 */
const PIECES: Piece[] = [
  // 1日目: ノズル（じょうご）・左の翼・右の翼（翼の先に補修のリベット）
  (b) =>
    group(
      {},
      path('M24 80 H40 L44 90 H20 Z', look(b, INK.steel)),
      detail(b, path('M28 80 V84 M36 80 V84', line(INK.steelDark, 1.5))),
    ),
  (b) =>
    group(
      {},
      path('M22 56 L8 74 V86 L22 80 Z', look(b, R.accent)),
      detail(b, circle(11, 80, 1.2, { fill: INK.outline })),
    ),
  (b) =>
    group(
      {},
      path('M42 56 L56 74 V86 L42 80 Z', look(b, R.accent)),
      detail(b, circle(53, 80, 1.2, { fill: INK.outline })),
    ),
  // 2日目: 胴体の下（ドラム缶: たがの線と手描きの「1」）・中（テープの継ぎはぎ）・上
  (b) =>
    group(
      {},
      rect(20, 62, 24, 18, look(b, R.body)),
      detail(
        b,
        path('M21.5 66 H42.5 M21.5 76 H42.5', line(R.bodyShade, 1.5)),
        // 手描きの「1」（ボルト1号）
        path('M30.5 69.5 L32.5 68 V75', line(R.accent, 1.8)),
      ),
    ),
  (b) =>
    group(
      {},
      rect(20, 46, 24, 16, look(b, R.body)),
      detail(b, path('M23 49 L29 55 M29 49 L23 55', line(INK.steelLight, 3))),
    ),
  (b) =>
    group(
      {},
      rect(20, 32, 24, 14, look(b, R.body)),
      detail(b, path('M22 35 V43', line(R.bodyShade, 2))),
    ),
  // 3日目: 窓（洗濯機の扉。中にボルトの顔）・先端（赤いバケツ）・アンテナ
  (b, empty) =>
    b
      ? group(
          {},
          circle(32, 53, 8.5, outlined(INK.steelLight, 3)),
          circle(32, 53, 5.5, { fill: R.window, stroke: INK.steelDark, 'stroke-width': 1.5 }),
          ...(empty
            ? [path('M29 51 q2 -2 4 -2', line(INK.white, 1.4))]
            : [
                circle(32, 54, 4, { fill: B.body }),
                circle(30.6, 53.2, 1.1, { fill: B.pupil }),
                circle(33.4, 53.2, 0.8, { fill: B.pupil }),
              ]),
        )
      : circle(32, 53, 8.5, ghost),
  (b) =>
    group(
      {},
      path('M20 32 C20 20 27 10 32 5 C37 10 44 20 44 32 Z', look(b, R.accent)),
      detail(
        b,
        path('M20.5 28 H43.5', line(R.accentShade, 2)),
        path('M23 22 Q32 14 41 22', line(INK.steelDark, 1.5)),
      ),
    ),
  (b) =>
    group(
      {},
      path('M32 5 V-1', b ? line(INK.steelLight, 2.5) : ghost),
      circle(32, -3.5, 3, b ? outlined(R.lamp, THIN) : ghost),
    ),
];

export const ROCKET_STAGES = PIECES.length;

/** stage 個の部品が組み上がったロケットの絵（座標は ROCKET_VIEW_BOX）。empty なら窓の中は空 */
export function rocketBody(stage: number, empty = false): string[] {
  // 翼は胴体の後ろに描く（部品の番号とは別に、描く順を決める）
  const order = [1, 2, 0, 3, 4, 5, 7, 6, 8];
  return order.map((i) => PIECES[i]!(i < stage, empty));
}

export const ROCKET_VIEW_BOX = VIEW_BOX;

/** stage 個の部品が組み上がったロケット */
export function rocketSvg(stage: number): string {
  return svg(`ボルトのロケット（${stage}/${ROCKET_STAGES}）`, rocketBody(stage), VIEW_BOX);
}

/** 発射の炎（ロケットの下に重ねて、画面側で揺らす） */
export function flameSvg(): string {
  return svg(
    'ロケットの炎',
    [
      path('M20 0 H44 C44 18 38 30 32 44 C26 30 20 18 20 0 Z', outlined(R.flame, 3)),
      path('M26 0 H38 C38 12 35 20 32 28 C29 20 26 12 26 0 Z', { fill: R.flameCore }),
    ],
    '0 -4 64 52',
  );
}

/** 発射の煙（炎の下に広がる。画面側で拡大しながら薄くする） */
export function smokeSvg(): string {
  return svg(
    'ロケットの煙',
    [
      circle(18, 30, 12, outlined(INK.steelLight, 3)),
      circle(46, 30, 12, outlined(INK.steelLight, 3)),
      circle(32, 24, 15, outlined(INK.white, 3)),
      path('M24 22 q4 -5 9 -3', line(INK.steelLight, 2)),
    ],
    '0 4 64 42',
  );
}

export function rocketFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (let stage = 0; stage <= ROCKET_STAGES; stage++) {
    files[`src/assets/rocket/rocket-${stage}.svg`] = rocketSvg(stage);
  }
  files['src/assets/rocket/flame.svg'] = flameSvg();
  files['src/assets/rocket/smoke.svg'] = smokeSvg();
  return files;
}
