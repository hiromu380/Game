/**
 * ボルトのロケット（1ランの目的）: 組み上がっていく9段階の絵と、発射の炎
 *
 * シフトをクリアするたびに1部品ずつ組み上がる（rocket-0 = 何もない ～ rocket-9 = 完成）。
 * まだの部品は点線の輪郭だけを描き、完成形がどうなるか最初からわかるようにする。
 * 部品の順: 1日目 = ノズル・左右の翼、2日目 = 胴体の下・中・上、3日目 = 窓（ボルトが乗る）・先端・アンテナ
 */
import { BOLT_COLORS as B, INK, ROCKET_COLORS as R } from '../src/assets/palette';
import { circle, group, line, outlined, path, rect, svg, THIN } from './svg';

/** 絵の座標系（縦長。一覧の正方形の枠にも収まるよう、左右に余白を持たせる） */
const VIEW_BOX = '-16 -8 96 104';

type Piece = (built: boolean) => string;

/** 組み上がっていない部品の見た目: 点線の輪郭だけ */
const ghost = { fill: 'none', stroke: R.ghost, 'stroke-width': 2, 'stroke-dasharray': '3 3' };
const look = (built: boolean, fill: string) => (built ? outlined(fill, 3) : ghost);

const PIECES: Piece[] = [
  // 1日目: ノズル・左の翼・右の翼
  (b) => path('M24 80 H40 L44 90 H20 Z', look(b, INK.steel)),
  (b) => path('M22 56 L8 74 V86 L22 80 Z', look(b, R.accent)),
  (b) => path('M42 56 L56 74 V86 L42 80 Z', look(b, R.accent)),
  // 2日目: 胴体の下・中・上（下には赤い帯）
  (b) =>
    group(
      {},
      rect(20, 62, 24, 18, look(b, R.body)),
      b ? rect(21.5, 70, 21, 5, { fill: R.accent }) : '',
    ),
  (b) => rect(20, 46, 24, 16, look(b, R.body)),
  (b) =>
    group(
      {},
      rect(20, 32, 24, 14, look(b, R.body)),
      b ? path('M22 35 V43', line(R.bodyShade, 2)) : '',
    ),
  // 3日目: 窓（中にボルトの顔）・先端・アンテナ
  (b) =>
    b
      ? group(
          {},
          circle(32, 53, 7.5, outlined(R.window, 3)),
          circle(32, 54, 5, { fill: B.body }),
          circle(30.2, 53, 1.3, { fill: B.pupil }),
          circle(33.8, 53, 1, { fill: B.pupil }),
        )
      : circle(32, 53, 7.5, ghost),
  (b) => path('M20 32 C20 20 27 10 32 5 C37 10 44 20 44 32 Z', look(b, R.accent)),
  (b) =>
    group(
      {},
      path('M32 5 V-1', b ? line(INK.steelLight, 2.5) : ghost),
      circle(32, -3.5, 3, b ? outlined(R.lamp, THIN) : ghost),
    ),
];

export const ROCKET_STAGES = PIECES.length;

/** stage 個の部品が組み上がったロケット */
export function rocketSvg(stage: number): string {
  // 翼は胴体の後ろに描く（部品の番号とは別に、描く順を決める）
  const order = [1, 2, 0, 3, 4, 5, 7, 6, 8];
  const body = order.map((i) => PIECES[i]!(i < stage));
  return svg(`ボルトのロケット（${stage}/${ROCKET_STAGES}）`, body, VIEW_BOX);
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

export function rocketFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  for (let stage = 0; stage <= ROCKET_STAGES; stage++) {
    files[`src/assets/rocket/rocket-${stage}.svg`] = rocketSvg(stage);
  }
  files['src/assets/rocket/flame.svg'] = flameSvg();
  return files;
}
